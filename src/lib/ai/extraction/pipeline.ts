import {
  db,
  competitors,
  trackedUrls,
  scrapeResults,
  pricingPlans,
  pricingSnapshots,
  featureSnapshots,
} from "@/lib/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { extractPricingFromMarkdown } from "@/lib/ai/extraction/extract-pricing";
import {
  NormalizedPricingPlan,
  NormalizedExtractionResult,
  ExtractionExecutionResult,
  ExtractionCounts,
} from "@/lib/ai/extraction/types";
import { SnapshotPlan } from "@/lib/changes/types";
import { detectChangesBetweenSnapshots } from "@/lib/changes/detect-changes";
import { persistDetectedChanges } from "@/lib/changes/persist-changes";

// Re-export ExtractionExecutionResult & ExtractionCounts from types
export type { ExtractionExecutionResult, ExtractionCounts } from "@/lib/ai/extraction/types";

// Active extraction locks to prevent concurrent duplicate extractions on the same scrape
const activeExtractions = new Set<string>();

export interface ExecuteExtractionOptions {
  force?: boolean; // When true, bypasses content-hash deduplication
}

/**
 * Runs extraction on a scrape, writes pricing plans & snapshots,
 * and performs deterministic historical change detection against previous snapshots.
 */
export async function executeExtractionForScrape(
  scrapeId: string,
  options?: ExecuteExtractionOptions
): Promise<ExtractionExecutionResult> {
  if (activeExtractions.has(scrapeId)) {
    throw new Error("An extraction is already in progress for this scrape result.");
  }

  activeExtractions.add(scrapeId);

  try {
    // 1. Load the scrape result
    const scrape = await db.query.scrapeResults.findFirst({
      where: eq(scrapeResults.id, scrapeId),
      with: {
        competitor: true,
        trackedUrl: true,
      },
    });

    if (!scrape) {
      throw new Error(`Scrape result not found: ${scrapeId}`);
    }

    if (scrape.status !== "SUCCESS") {
      throw new Error(
        `Cannot extract pricing from a failed scrape (scrape status: ${scrape.status}).`
      );
    }

    // 2. Fetch previous valid snapshots for baseline comparison BEFORE creating new snapshots
    const previousRawSnapshots = await db.query.pricingSnapshots.findMany({
      where: eq(pricingSnapshots.competitorId, scrape.competitorId),
      orderBy: [desc(pricingSnapshots.observedAt)],
    });

    // Group previous snapshots by unique planId (taking the latest snapshot per plan)
    const latestSnapshotPerPlan = new Map<string, typeof previousRawSnapshots[0]>();
    for (const snap of previousRawSnapshots) {
      const key = snap.pricingPlanId || snap.planName.toLowerCase();
      if (!latestSnapshotPerPlan.has(key)) {
        latestSnapshotPerPlan.set(key, snap);
      }
    }

    const previousPlans: SnapshotPlan[] = Array.from(latestSnapshotPerPlan.values()).map(
      (s) => ({
        id: s.id,
        pricingPlanId: s.pricingPlanId,
        planName: s.planName,
        price: s.price,
        currency: s.currency,
        billingPeriod: s.billingPeriod,
        features: s.features,
        usageLimits: s.usageLimits,
        sourceUrl: s.sourceUrl,
        observedAt: s.observedAt,
      })
    );

    // 2. Content-Hash Deduplication Check:
    // If a preceding successful scrape exists with the exact same contentHash and existing pricing snapshots exist,
    // avoid redundant LLM extraction unless force=true.
    if (!options?.force) {
      const priorScrapeWithSameHash = await db.query.scrapeResults.findFirst({
        where: (t, { and, eq, ne }) =>
          and(
            eq(t.competitorId, scrape.competitorId),
            eq(t.sourceUrl, scrape.sourceUrl),
            eq(t.contentHash, scrape.contentHash),
            eq(t.status, "SUCCESS"),
            ne(t.id, scrape.id)
          ),
        orderBy: [desc(scrapeResults.scrapedAt)],
      });

      if (priorScrapeWithSameHash && previousRawSnapshots.length > 0) {
        // Content has not changed since the previous extraction.
        // Return existing active plans without running unnecessary duplicate extraction.
        const currentActivePlans = await db.query.pricingPlans.findMany({
          where: and(
            eq(pricingPlans.competitorId, scrape.competitorId),
            eq(pricingPlans.isActive, true)
          ),
        });

        return {
          scrapeId: scrape.id,
          competitorId: scrape.competitorId,
          status: "SUCCESS",
          extractedPlanCount: currentActivePlans.length,
          extractedFeatureCount: currentActivePlans.reduce((acc, p) => acc + (p.features?.length || 0), 0),
          detectedChangesCount: 0,
          counts: {
            modelExtracted: currentActivePlans.length,
            validated: currentActivePlans.length,
            distinctOfferings: currentActivePlans.length,
            persisted: currentActivePlans.length,
            skipped: 0,
          },
          warnings: ["Content hash unchanged since last scrape; skipped redundant LLM extraction."],
          plans: currentActivePlans.map((p) => ({
            id: p.id,
            planName: p.planName,
            price: p.price,
            currency: p.currency,
            billingPeriod: p.billingPeriod || "monthly",
          })),
        };
      }
    }
    const extraction: NormalizedExtractionResult = await extractPricingFromMarkdown({
      url: scrape.sourceUrl,
      markdown: scrape.markdownContent,
      pageTitle: scrape.pageTitle,
      competitorName: scrape.competitor?.name,
    });

    if (extraction.status === "NO_PRICING_FOUND") {
      // Update trackedUrl extraction status if trackedUrlId is present
      if (scrape.trackedUrlId) {
        await db
          .update(trackedUrls)
          .set({
            lastExtractionStatus: "NO_PRICING_FOUND",
            lastExtractedAt: new Date(),
            lastExtractionError: null,
            lastExtractedPlanCount: "0",
            lastExtractedFeatureCount: "0",
            updatedAt: new Date(),
          })
          .where(eq(trackedUrls.id, scrape.trackedUrlId));
      }

      return {
        scrapeId: scrape.id,
        competitorId: scrape.competitorId,
        status: "NO_PRICING_FOUND",
        extractedPlanCount: 0,
        extractedFeatureCount: 0,
        detectedChangesCount: 0,
        counts: {
          modelExtracted: 0,
          validated: 0,
          distinctOfferings: 0,
          persisted: 0,
          skipped: 0,
        },
        warnings: [
          "Page was analyzed but no pricing tiers or subscription models were detected in the source content.",
        ],
        plans: [],
      };
    }

    const savedPlans: Array<{
      id: string;
      planName: string;
      price: string | null;
      currency: string | null;
      billingPeriod: string;
    }> = [];

    const currentPlansForComparison: SnapshotPlan[] = [];
    let totalFeaturesInserted = 0;
    const now = new Date();

    const batchId = crypto.randomUUID();

    // 4. Sequential atomic persistence of current plans & immutable snapshots
    for (const plan of extraction.plans) {
      // Identity check: match competitorId AND planName (case-insensitive) AND billingPeriod AND currency
      const existingPlan = await db.query.pricingPlans.findFirst({
        where: and(
          eq(pricingPlans.competitorId, scrape.competitorId),
          sql`lower(${pricingPlans.planName}) = ${plan.planName.trim().toLowerCase()}`,
          eq(pricingPlans.billingPeriod, plan.billingPeriod),
          plan.currency ? eq(pricingPlans.currency, plan.currency) : undefined
        ),
      });

      let targetPlanId: string;

      // Quality Guard: Check aggregate extracted features across ALL plans in this batch
      // rather than single plan.features.length to avoid false alarms on multi-plan pages
      if (scrape.trackedUrlId) {
        const priorUrlSnaps = await db.query.featureSnapshots.findMany({
          where: and(
            eq(featureSnapshots.competitorId, scrape.competitorId),
            eq(featureSnapshots.trackedUrlId, scrape.trackedUrlId)
          ),
          limit: 100,
        });

        const previousFeaturesCount = priorUrlSnaps.length;
        const totalBatchFeaturesCount = extraction.plans.reduce((acc, p) => acc + p.features.length, 0);
        const isMarkdownSubstantiallyReduced = (scrape.markdownContent?.length || 0) < 500;

        if (
          previousFeaturesCount >= 10 &&
          totalBatchFeaturesCount < previousFeaturesCount * 0.3 &&
          !isMarkdownSubstantiallyReduced
        ) {
          console.warn(
            `[QualityGuard] Rejected suspicious feature drop for competitor ${scrape.competitorId}, url ${scrape.trackedUrlId}: prior=${previousFeaturesCount}, currentBatch=${totalBatchFeaturesCount}`
          );
          // Return FLAGGED_FOR_REVIEW without overwriting feature snapshots
          if (scrape.trackedUrlId) {
            await db
              .update(trackedUrls)
              .set({
                lastExtractionStatus: "FLAGGED_FOR_REVIEW",
                lastExtractedAt: now,
                lastExtractionError: `Suspicious feature drop detected: extracted only ${totalBatchFeaturesCount} features compared to ${previousFeaturesCount} previously observed. Prior valid snapshots preserved.`,
                lastExtractedPlanCount: String(savedPlans.length),
                lastExtractedFeatureCount: String(previousFeaturesCount),
              })
              .where(eq(trackedUrls.id, scrape.trackedUrlId));
          }

          return {
            scrapeId: scrape.id,
            competitorId: scrape.competitorId,
            status: "FLAGGED_FOR_REVIEW",
            extractedPlanCount: savedPlans.length,
            extractedFeatureCount: 0,
            detectedChangesCount: 0,
            counts: {
              modelExtracted: extraction.modelExtractedCount || extraction.plans.length,
              validated: extraction.validatedCount || extraction.plans.length,
              distinctOfferings: extraction.plans.length,
              persisted: savedPlans.length,
              skipped: extraction.plans.length - savedPlans.length,
              skippedReasons: { "FLAGGED_FOR_REVIEW_FEATURE_DROP": extraction.plans.length - savedPlans.length },
            },
            warnings: [
              `Suspicious feature drop detected: extracted only ${totalBatchFeaturesCount} features compared to ${previousFeaturesCount} previously observed. Prior valid snapshots preserved.`,
            ],
            plans: savedPlans,
          };
        }
      }

      // Format features list for pricing_plans & pricing_snapshots JSONB array
      const planFeaturesJson = plan.features.map((f) => f.name);

      if (existingPlan) {
        const [updated] = await db
          .update(pricingPlans)
          .set({
            description: plan.description,
            price: plan.price,
            currency: plan.currency || "USD",
            billingPeriod: plan.billingPeriod,
            isCustomPricing: plan.isCustomPricing,
            isActive: true,
            features: planFeaturesJson,
            usageLimits: plan.usageLimits,
            sourceUrl: scrape.sourceUrl,
            updatedAt: now,
          })
          .where(eq(pricingPlans.id, existingPlan.id))
          .returning();

        targetPlanId = updated.id;
      } else {
        const [inserted] = await db
          .insert(pricingPlans)
          .values({
            competitorId: scrape.competitorId,
            planName: plan.planName,
            description: plan.description,
            price: plan.price,
            currency: plan.currency || "USD",
            billingPeriod: plan.billingPeriod,
            isCustomPricing: plan.isCustomPricing,
            isActive: true,
            features: planFeaturesJson,
            usageLimits: plan.usageLimits,
            sourceUrl: scrape.sourceUrl,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        targetPlanId = inserted.id;
      }

      savedPlans.push({
        id: targetPlanId,
        planName: plan.planName,
        price: plan.price,
        currency: plan.currency,
        billingPeriod: plan.billingPeriod,
      });

      // Insert Immutable Pricing Snapshot
      const [newSnapshot] = await db
        .insert(pricingSnapshots)
        .values({
          competitorId: scrape.competitorId,
          pricingPlanId: targetPlanId,
          planName: plan.planName,
          price: plan.price,
          currency: plan.currency || "USD",
          billingPeriod: plan.billingPeriod,
          features: planFeaturesJson,
          usageLimits: plan.usageLimits,
          sourceUrl: scrape.sourceUrl,
          observedAt: now,
        })
        .returning();

      currentPlansForComparison.push({
        id: newSnapshot.id,
        pricingPlanId: targetPlanId,
        planName: plan.planName,
        price: plan.price,
        currency: plan.currency || "USD",
        billingPeriod: plan.billingPeriod,
        features: planFeaturesJson,
        usageLimits: plan.usageLimits,
        sourceUrl: scrape.sourceUrl,
        observedAt: now,
      });

      // Insert Feature Snapshots preserving rich value format
      for (const feature of plan.features) {
        const displayValue =
          feature.originalValue && feature.originalValue !== feature.availability
            ? feature.originalValue
            : feature.availability + (feature.numericLimit ? ` (${feature.numericLimit}${feature.limitUnit ? " " + feature.limitUnit : ""})` : "");

        await db.insert(featureSnapshots).values({
          competitorId: scrape.competitorId,
          pricingPlanId: targetPlanId,
          trackedUrlId: scrape.trackedUrlId || null,
          scrapeResultId: scrape.id,
          batchId,
          featureName: feature.name,
          featureValue: displayValue,
          sourceUrl: scrape.sourceUrl,
          observedAt: now,
        });
        totalFeaturesInserted++;
      }
    }

    // 5. Run Change Detection against the previous baseline
    const isComplete = extraction.status === "SUCCESS";
    const detectedChanges = detectChangesBetweenSnapshots({
      competitorId: scrape.competitorId,
      previousPlans,
      currentPlans: currentPlansForComparison,
      isCompleteExtraction: isComplete,
    });

    // 6. Persist detected changes idempotently
    const { insertedCount } = await persistDetectedChanges(detectedChanges);

    // 7. Persist extraction status on tracked URL
    if (scrape.trackedUrlId) {
      await db
        .update(trackedUrls)
        .set({
          lastExtractionStatus: extraction.status,
          lastExtractedAt: now,
          lastExtractionError: extraction.reviewReason || null,
          lastExtractedPlanCount: String(savedPlans.length),
          lastExtractedFeatureCount: String(totalFeaturesInserted),
          updatedAt: now,
        })
        .where(eq(trackedUrls.id, scrape.trackedUrlId));
    }

    return {
      scrapeId: scrape.id,
      competitorId: scrape.competitorId,
      status: extraction.status,
      extractedPlanCount: savedPlans.length,
      extractedFeatureCount: totalFeaturesInserted,
      detectedChangesCount: insertedCount,
      counts: {
        modelExtracted: extraction.modelExtractedCount || extraction.plans.length,
        validated: extraction.validatedCount || extraction.plans.length,
        distinctOfferings: extraction.plans.length,
        persisted: savedPlans.length,
        skipped: Math.max(0, (extraction.modelExtractedCount || extraction.plans.length) - savedPlans.length),
        skippedReasons:
          (extraction.modelExtractedCount || extraction.plans.length) > savedPlans.length
            ? { "DUPLICATE_OR_INVALID": (extraction.modelExtractedCount || extraction.plans.length) - savedPlans.length }
            : undefined,
      },
      warnings: extraction.reviewReason ? [extraction.reviewReason] : undefined,
      plans: savedPlans,
    };
  } finally {
    activeExtractions.delete(scrapeId);
  }
}
