import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  competitors,
  pricingPlans,
  featureSnapshots,
  trackedUrls,
} from "@/lib/db/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { successResponse, handleApiError } from "@/lib/api/response";
import { normalizeFeatureAvailability } from "@/lib/ai/extraction/types";

const ComparisonQuerySchema = z.object({
  competitorIds: z.string().optional(), // Comma-separated competitor IDs
  currency: z.string().optional(),
  billingPeriod: z.enum(["all", "monthly", "yearly", "annual", "custom"]).default("all"),
});

export interface PlanFeatureMatrixDetail {
  name: string;
  availability: "included" | "not_included" | "limited" | "unknown";
  originalValue: string;
  numericLimit?: number | null;
  limitUnit?: string | null;
  limitationDescription?: string | null;
  evidenceText?: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = ComparisonQuerySchema.parse(searchParams);

    let competitorFilter = undefined;
    if (query.competitorIds) {
      const ids = query.competitorIds.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        competitorFilter = inArray(competitors.id, ids);
      }
    }

    const plansQuery = db
      .select({
        planId: pricingPlans.id,
        planName: pricingPlans.planName,
        description: pricingPlans.description,
        price: pricingPlans.price,
        currency: pricingPlans.currency,
        billingPeriod: pricingPlans.billingPeriod,
        isCustomPricing: pricingPlans.isCustomPricing,
        features: pricingPlans.features,
        usageLimits: pricingPlans.usageLimits,
        sourceUrl: pricingPlans.sourceUrl,
        updatedAt: pricingPlans.updatedAt,
        competitorId: competitors.id,
        competitorName: competitors.name,
        competitorDomain: competitors.domain,
        competitorIndustry: competitors.industry,
      })
      .from(pricingPlans)
      .innerJoin(competitors, eq(pricingPlans.competitorId, competitors.id))
      .where(
        and(
          eq(pricingPlans.isActive, true),
          competitorFilter,
          query.billingPeriod !== "all" ? eq(pricingPlans.billingPeriod, query.billingPeriod) : undefined,
          query.currency ? eq(pricingPlans.currency, query.currency.toUpperCase()) : undefined
        )
      );

    const rows = await plansQuery;
    const planIds = rows.map((r) => r.planId);

    // Synchronize latest feature state:
    // Multi-URL Feature Aggregation:
    // 1. Query the latest feature snapshots independently for each (pricing_plan_id, tracked_url_id).
    // 2. Also query legacy snapshots where tracked_url_id is null.
    // 3. For each plan, aggregate features across all tracked URLs using deterministic source precedence:
    //    'pricing' > 'features' / 'product' > other/null.
    // 4. Preserve source URL, observation timestamp, and resolve conflicts deterministically.
    const latestAggregatedSnapshotsByPlan = new Map<
      string,
      Map<
        string,
        {
          featureName: string;
          featureValue: string | null;
          sourceUrl: string | null;
          observedAt: Date;
          pageType: string;
        }
      >
    >();

    if (planIds.length > 0) {
      // Fetch latest snapshots with trackedUrl joined to know pageType
      const rawLatestRows = await db
        .select({
          pricingPlanId: featureSnapshots.pricingPlanId,
          trackedUrlId: featureSnapshots.trackedUrlId,
          featureName: featureSnapshots.featureName,
          featureValue: featureSnapshots.featureValue,
          sourceUrl: featureSnapshots.sourceUrl,
          observedAt: featureSnapshots.observedAt,
          pageType: trackedUrls.pageType,
        })
        .from(featureSnapshots)
        .leftJoin(trackedUrls, eq(featureSnapshots.trackedUrlId, trackedUrls.id))
        .where(
          and(
            inArray(featureSnapshots.pricingPlanId, planIds),
            sql`(${featureSnapshots.pricingPlanId}, COALESCE(${featureSnapshots.trackedUrlId}, '00000000-0000-0000-0000-000000000000'::uuid), ${featureSnapshots.observedAt}) IN (
              SELECT pricing_plan_id, COALESCE(tracked_url_id, '00000000-0000-0000-0000-000000000000'::uuid), MAX(observed_at)
              FROM ${featureSnapshots}
              GROUP BY pricing_plan_id, COALESCE(tracked_url_id, '00000000-0000-0000-0000-000000000000'::uuid)
            )`
          )
        );

      // Precedence weights: higher score wins on conflict
      const getPrecedence = (pageType: string | null | undefined, sourceUrl: string | null): number => {
        const type = (pageType || "").toLowerCase();
        const url = (sourceUrl || "").toLowerCase();
        if (type === "pricing" || url.includes("pricing")) return 30;
        if (type === "features" || type === "product" || url.includes("feature") || url.includes("product")) return 20;
        return 10;
      };

      for (const row of rawLatestRows) {
        if (!row.pricingPlanId) continue;
        if (!latestAggregatedSnapshotsByPlan.has(row.pricingPlanId)) {
          latestAggregatedSnapshotsByPlan.set(row.pricingPlanId, new Map());
        }
        const planFeaturesMap = latestAggregatedSnapshotsByPlan.get(row.pricingPlanId)!;
        const lowerName = row.featureName.trim().toLowerCase();

        const currentCandidate = {
          featureName: row.featureName.trim(),
          featureValue: row.featureValue,
          sourceUrl: row.sourceUrl,
          observedAt: row.observedAt,
          pageType: row.pageType || "other",
        };

        if (!planFeaturesMap.has(lowerName)) {
          planFeaturesMap.set(lowerName, currentCandidate);
        } else {
          // Resolve conflict using source precedence
          const existing = planFeaturesMap.get(lowerName)!;
          const existingPrec = getPrecedence(existing.pageType, existing.sourceUrl);
          const currentPrec = getPrecedence(currentCandidate.pageType, currentCandidate.sourceUrl);

          if (currentPrec > existingPrec) {
            planFeaturesMap.set(lowerName, currentCandidate);
          } else if (currentPrec === existingPrec) {
            // Disagreement at equal precedence: newer observation wins
            if (currentCandidate.observedAt > existing.observedAt) {
              planFeaturesMap.set(lowerName, currentCandidate);
            }
          }
        }
      }
    }

    // Group by competitor
    const competitorMap = new Map<string, {
      competitor: {
        id: string;
        name: string;
        domain: string;
        industry: string | null;
      };
      plans: Array<{
        id: string;
        planName: string;
        description: string | null;
        price: string | null;
        numericPrice: number | null;
        isFree: boolean;
        isCustomPricing: boolean;
        currency: string | null;
        billingPeriod: string | null;
        isComparable: boolean;
        features: string[]; // string names for backward compatibility
        featureDetails: Record<string, PlanFeatureMatrixDetail>;
        usageLimits: Record<string, unknown>;
        sourceUrl: string | null;
        updatedAt: Date;
      }>;
    }>();

    // Collect all distinct feature names across all compared plans for matrix comparison
    const allUniqueFeatures = new Set<string>();

    for (const r of rows) {
      if (!competitorMap.has(r.competitorId)) {
        competitorMap.set(r.competitorId, {
          competitor: {
            id: r.competitorId,
            name: r.competitorName,
            domain: r.competitorDomain,
            industry: r.competitorIndustry,
          },
          plans: [],
        });
      }

      const numPrice = r.price !== null ? parseFloat(r.price) : null;
      const isFree = numPrice === 0;
      const isCustom = r.isCustomPricing || numPrice === null;
      const isComparable = !isCustom && numPrice !== null;

      const featureDetails: Record<string, PlanFeatureMatrixDetail> = {};
      const featureNames: string[] = [];

      // 1. Process latest aggregated feature snapshots for this plan across all tracked URLs
      const latestSnapsMap = latestAggregatedSnapshotsByPlan.get(r.planId);
      const latestSnaps = latestSnapsMap ? Array.from(latestSnapsMap.values()) : [];

      if (latestSnaps.length > 0) {
        for (const snap of latestSnaps) {
          const fname = snap.featureName.trim();
          const lower = fname.toLowerCase();
          const rawVal = snap.featureValue || "included";
          const avail = normalizeFeatureAvailability(rawVal);

          let numericLimit: number | null = null;
          let limitUnit: string | null = null;
          const match = rawVal.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z%xX]+)?$/);
          if (match) {
            numericLimit = parseFloat(match[1]);
            limitUnit = match[2] || null;
          }

          featureDetails[lower] = {
            name: fname,
            availability: avail,
            originalValue: rawVal,
            numericLimit,
            limitUnit,
            limitationDescription: avail === "limited" ? rawVal : null,
          };
          featureNames.push(fname);
          allUniqueFeatures.add(fname);
        }
      } else {
        // Fallback to pricingPlans.features JSONB if no snapshot exists yet
        if (Array.isArray(r.features)) {
          for (const item of r.features) {
            if (typeof item === "string") {
              const trimmed = item.trim();
              if (trimmed) {
                const avail = normalizeFeatureAvailability(trimmed);
                featureDetails[trimmed.toLowerCase()] = {
                  name: trimmed,
                  availability: avail,
                  originalValue: trimmed,
                  limitationDescription: avail === "limited" ? trimmed : null,
                };
                featureNames.push(trimmed);
                allUniqueFeatures.add(trimmed);
              }
            } else if (typeof item === "object" && item !== null) {
              const obj = item as Record<string, unknown>;
              const fname = String(obj.name || obj.featureName || "").trim();
              if (fname) {
                const origVal = String(obj.originalValue || obj.value || obj.availability || "included");
                const avail = (obj.availability as any) || normalizeFeatureAvailability(origVal);
                featureDetails[fname.toLowerCase()] = {
                  name: fname,
                  availability: avail,
                  originalValue: origVal,
                  numericLimit: typeof obj.numericLimit === "number" ? obj.numericLimit : null,
                  limitUnit: obj.limitUnit ? String(obj.limitUnit) : null,
                  limitationDescription: obj.limitationDescription ? String(obj.limitationDescription) : (avail === "limited" ? origVal : null),
                  evidenceText: obj.evidenceText ? String(obj.evidenceText) : null,
                };
                featureNames.push(fname);
                allUniqueFeatures.add(fname);
              }
            }
          }
        }
      }

      competitorMap.get(r.competitorId)!.plans.push({
        id: r.planId,
        planName: r.planName,
        description: r.description,
        price: r.price,
        numericPrice: numPrice,
        isFree,
        isCustomPricing: isCustom,
        currency: r.currency,
        billingPeriod: r.billingPeriod,
        isComparable,
        features: featureNames,
        featureDetails,
        usageLimits: (r.usageLimits || {}) as Record<string, unknown>,
        sourceUrl: r.sourceUrl,
        updatedAt: r.updatedAt,
      });
    }

    const comparisonData = {
      competitors: Array.from(competitorMap.values()),
      matrixSummary: {
        totalCompetitors: competitorMap.size,
        totalPlans: rows.length,
        distinctFeaturesCount: allUniqueFeatures.size,
        distinctFeatures: Array.from(allUniqueFeatures).slice(0, 50),
      },
    };

    return successResponse(comparisonData, {
      filters: {
        competitorIds: query.competitorIds || null,
        currency: query.currency || null,
        billingPeriod: query.billingPeriod,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
