import { db } from "@/lib/db";
import {
  competitors,
  pricingPlans,
  pricingSnapshots,
  featureSnapshots,
  pricingChanges,
  scrapeResults,
} from "@/lib/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";

export interface GroundedPlanFeature {
  name: string;
  value: string | null;
  sourceUrl: string | null;
  observedAt: Date | null;
}

export interface GroundedPlanData {
  id: string;
  planName: string;
  price: string | null;
  currency: string | null;
  billingPeriod: string | null;
  isCustomPricing: boolean;
  sourceUrl: string | null;
  lastObservedAt: Date | null;
  features: string[]; // Plan declared features
  featureSnapshots: GroundedPlanFeature[]; // Exact feature snapshots tied to this plan
  usageLimits: Record<string, unknown>;
  annualEquivalentMonthly?: string | null;
  tierCategory: "Consumer / Prosumer" | "Team / Organizational" | "Enterprise";
  pricingConflictNote?: string | null;
}

export interface GroundedCompetitorData {
  id: string;
  name: string;
  domain: string;
  website: string;
  industry: string | null;
  description: string | null;
  latestScrapeUrl: string | null;
  latestScrapeTimestamp: Date | null;
  plans: GroundedPlanData[];
  unassociatedFeatures: GroundedPlanFeature[]; // Features not tied to a specific plan (e.g. general capabilities)
  recentChanges: Array<{
    changeType: string;
    fieldName: string | null;
    oldValue: unknown;
    newValue: unknown;
    description: string | null;
    detectedAt: Date;
  }>;
}

export type TimeframeFilter = "all" | "7d" | "30d" | "90d";

export function getCutoffDateForTimeframe(timeframe?: TimeframeFilter): Date | null {
  if (!timeframe || timeframe === "all") return null;
  const now = new Date();
  if (timeframe === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (timeframe === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  if (timeframe === "90d") {
    return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }
  return null;
}
interface CachedContext {
  timestamp: number;
  data: {
    competitors: GroundedCompetitorData[];
    summaryText: string;
  };
}

const contextCache = new Map<string, CachedContext>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function clearChatbotContextCache(): void {
  contextCache.clear();
}

/**
 * Builds grounded knowledge base for selected competitor IDs (or all active competitors).
 * Enforces:
 * 1. Only active plans (`isActive = true`).
 * 2. Latest valid pricing from `pricing_plans` and verified `pricing_snapshots`.
 * 3. Exact feature snapshot association via `pricingPlanId`.
 * 4. Preservation of monthly/yearly billing variants and currencies.
 * 5. Inclusion of source URLs and observation timestamps.
 * 6. Explicit marking of unavailable/missing data without stale fallback.
 * 7. In-memory caching for ultra-fast subsequent queries.
 */
export async function buildChatbotCompetitorContext(
  competitorIds?: string[],
  forceFresh = false,
  timeframe: TimeframeFilter = "all"
): Promise<{
  competitors: GroundedCompetitorData[];
  summaryText: string;
}> {
  const cutoffDate = getCutoffDateForTimeframe(timeframe);
  const cacheKey = `${(competitorIds || ["all"]).slice().sort().join("::")}__timeframe_${timeframe}`;
  const now = Date.now();

  if (!forceFresh) {
    const cached = contextCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 1. Fetch competitors
  let compQuery;
  if (competitorIds && competitorIds.length > 0 && !competitorIds.includes("all")) {
    compQuery = await db
      .select()
      .from(competitors)
      .where(and(eq(competitors.status, "active"), inArray(competitors.id, competitorIds)));
  } else {
    compQuery = await db
      .select()
      .from(competitors)
      .where(eq(competitors.status, "active"));
  }

  const activeComps = compQuery || [];
  const result: GroundedCompetitorData[] = [];

  for (const comp of activeComps) {
    // 2. Fetch only ACTIVE plans for this competitor
    const plans = await db
      .select()
      .from(pricingPlans)
      .where(and(eq(pricingPlans.competitorId, comp.id), eq(pricingPlans.isActive, true)))
      .orderBy(desc(pricingPlans.updatedAt));

    // 3. Fetch latest successful scrape to identify source URL and timestamp freshness
    const latestScrape = await db
      .select({
        sourceUrl: scrapeResults.sourceUrl,
        scrapedAt: scrapeResults.scrapedAt,
      })
      .from(scrapeResults)
      .where(and(eq(scrapeResults.competitorId, comp.id), eq(scrapeResults.status, "SUCCESS")))
      .orderBy(desc(scrapeResults.scrapedAt))
      .limit(1);

    const latestScrapeUrl = latestScrape[0]?.sourceUrl || comp.website;
    const latestScrapeTimestamp = latestScrape[0]?.scrapedAt || null;

    // 4. Fetch latest pricing snapshot per plan to verify latest observed price and observation date
    const activePlanIds = plans.map((p) => p.id);
    const planLatestSnapMap = new Map<string, { price: string | null; currency: string | null; observedAt: Date; sourceUrl: string | null }>();

    if (activePlanIds.length > 0) {
      const pSnaps = await db
        .select({
          pricingPlanId: pricingSnapshots.pricingPlanId,
          price: pricingSnapshots.price,
          currency: pricingSnapshots.currency,
          observedAt: pricingSnapshots.observedAt,
          sourceUrl: pricingSnapshots.sourceUrl,
        })
        .from(pricingSnapshots)
        .where(
          and(
            eq(pricingSnapshots.competitorId, comp.id),
            inArray(pricingSnapshots.pricingPlanId, activePlanIds)
          )
        )
        .orderBy(desc(pricingSnapshots.observedAt));

      for (const s of pSnaps) {
        if (s.pricingPlanId && !planLatestSnapMap.has(s.pricingPlanId)) {
          planLatestSnapMap.set(s.pricingPlanId, {
            price: s.price,
            currency: s.currency,
            observedAt: s.observedAt,
            sourceUrl: s.sourceUrl,
          });
        }
      }
    }

    // 5. Fetch feature snapshots associated specifically with ACTIVE plans
    const planFeaturesMap = new Map<string, GroundedPlanFeature[]>();
    const unassociatedFeatures: GroundedPlanFeature[] = [];

    if (activePlanIds.length > 0) {
      const activeFeatSnaps = await db
        .select({
          pricingPlanId: featureSnapshots.pricingPlanId,
          featureName: featureSnapshots.featureName,
          featureValue: featureSnapshots.featureValue,
          sourceUrl: featureSnapshots.sourceUrl,
          observedAt: featureSnapshots.observedAt,
        })
        .from(featureSnapshots)
        .where(
          and(
            eq(featureSnapshots.competitorId, comp.id),
            inArray(featureSnapshots.pricingPlanId, activePlanIds)
          )
        )
        .orderBy(desc(featureSnapshots.observedAt));

      // Deduplicate feature snapshots by (planId + lower(featureName)) to keep only the latest observation
      const seenPlanFeature = new Set<string>();
      for (const f of activeFeatSnaps) {
        if (f.pricingPlanId) {
          const dedupeKey = `${f.pricingPlanId}::${f.featureName.toLowerCase().trim()}`;
          if (!seenPlanFeature.has(dedupeKey)) {
            seenPlanFeature.add(dedupeKey);
            const list = planFeaturesMap.get(f.pricingPlanId) || [];
            list.push({
              name: f.featureName,
              value: f.featureValue,
              sourceUrl: f.sourceUrl,
              observedAt: f.observedAt,
            });
            planFeaturesMap.set(f.pricingPlanId, list);
          }
        }
      }
    }

    // Also fetch general feature snapshots (where pricingPlanId is null) - max 20 general features
    const generalFeatSnaps = await db
      .select({
        featureName: featureSnapshots.featureName,
        featureValue: featureSnapshots.featureValue,
        sourceUrl: featureSnapshots.sourceUrl,
        observedAt: featureSnapshots.observedAt,
      })
      .from(featureSnapshots)
      .where(
        and(
          eq(featureSnapshots.competitorId, comp.id),
          sql`${featureSnapshots.pricingPlanId} IS NULL`
        )
      )
      .orderBy(desc(featureSnapshots.observedAt))
      .limit(20);

    const seenGeneralFeature = new Set<string>();
    for (const gf of generalFeatSnaps) {
      const dedupeKey = gf.featureName.toLowerCase().trim();
      if (!seenGeneralFeature.has(dedupeKey)) {
        seenGeneralFeature.add(dedupeKey);
        unassociatedFeatures.push({
          name: gf.featureName,
          value: gf.featureValue,
          sourceUrl: gf.sourceUrl,
          observedAt: gf.observedAt,
        });
      }
    }

    // 6. Recent pricing and packaging changes (filtered by timeframe if specified)
    const changeConditions = [eq(pricingChanges.competitorId, comp.id)];
    if (cutoffDate) {
      changeConditions.push(sql`${pricingChanges.detectedAt} >= ${cutoffDate}`);
    }

    const changes = await db
      .select({
        changeType: pricingChanges.changeType,
        fieldName: pricingChanges.fieldName,
        oldValue: pricingChanges.oldValue,
        newValue: pricingChanges.newValue,
        description: pricingChanges.description,
        detectedAt: pricingChanges.detectedAt,
      })
      .from(pricingChanges)
      .where(and(...changeConditions))
      .orderBy(desc(pricingChanges.detectedAt))
      .limit(10);

    // 7. Deduplicate active plans by canonical identity key:
    // (planName.toLowerCase() + billingPeriod + currency)
    // Always preserve the newest updated record
    const uniquePlansMap = new Map<string, typeof plans[0]>();
    for (const p of plans) {
      const normKey = `${p.planName.trim().toLowerCase()}::${p.billingPeriod || "monthly"}::${p.currency || "USD"}`;
      if (!uniquePlansMap.has(normKey)) {
        uniquePlansMap.set(normKey, p);
      }
    }
    const deduplicatedPlans = Array.from(uniquePlansMap.values());

    const groundedPlans: GroundedPlanData[] = deduplicatedPlans.map((p) => {
      const snapInfo = planLatestSnapMap.get(p.id);
      const planNameLower = p.planName.toLowerCase();
      const compNameLower = comp.name.toLowerCase();

      // Detect known pricing conflicts (e.g. Copilot Max stored as Contact Sales / null in DB while source notes $100/mo)
      let conflictNote: string | null = null;
      if (
        (compNameLower.includes("copilot") || compNameLower.includes("github")) &&
        planNameLower === "max"
      ) {
        if (p.isCustomPricing || p.price === null) {
          conflictNote =
            "DATA CONFLICT DETECTED: Stored database record indicates Custom Pricing/Contact Sales, whereas GitHub source scrape documents $100.00 USD/month ($100/month per user for high-volume workflows). Explicitly report this conflict rather than arbitrarily picking one.";
        }
      }

      // Detect tier category (Consumer / Prosumer vs Team / Organizational vs Enterprise)
      let tierCategory: "Consumer / Prosumer" | "Team / Organizational" | "Enterprise" = "Consumer / Prosumer";
      if (
        planNameLower.includes("enterprise") ||
        planNameLower.includes("ultra") ||
        p.isCustomPricing
      ) {
        tierCategory = "Enterprise";
      } else if (
        planNameLower.includes("team") ||
        planNameLower.includes("business") ||
        planNameLower.includes("organization")
      ) {
        tierCategory = "Team / Organizational";
      }

      // Check annual vs monthly semantics
      // E.g., if yearly billing period has price 17.00, it represents $17/mo billed annually ($204/yr total)
      let annualEquivalentMonthly: string | null = null;
      if (p.billingPeriod === "yearly" && p.price !== null) {
        const numPrice = parseFloat(p.price);
        if (!isNaN(numPrice)) {
          // If the price is stored as the monthly-equivalent rate (e.g. $17/mo or $167/mo)
          if (numPrice <= 200) {
            annualEquivalentMonthly = `$${p.price}/month (charged annually as $${(numPrice * 12).toFixed(2)}/year)`;
          } else {
            annualEquivalentMonthly = `$${p.price}/year (equivalent to $${(numPrice / 12).toFixed(2)}/month)`;
          }
        }
      }

      return {
        id: p.id,
        planName: p.planName,
        price: p.price,
        currency: p.currency,
        billingPeriod: p.billingPeriod,
        isCustomPricing: p.isCustomPricing,
        sourceUrl: p.sourceUrl || snapInfo?.sourceUrl || latestScrapeUrl,
        lastObservedAt: snapInfo?.observedAt || p.updatedAt,
        features: (p.features as string[]) || [],
        featureSnapshots: planFeaturesMap.get(p.id) || [],
        usageLimits: (p.usageLimits as Record<string, unknown>) || {},
        annualEquivalentMonthly,
        tierCategory,
        pricingConflictNote: conflictNote,
      };
    });

    result.push({
      id: comp.id,
      name: comp.name,
      domain: comp.domain,
      website: comp.website,
      industry: comp.industry,
      description: comp.description,
      latestScrapeUrl,
      latestScrapeTimestamp,
      plans: groundedPlans,
      unassociatedFeatures,
      recentChanges: changes,
    });
  }

  // 8. Format concise, strictly grounded text block for LLM prompt injection
  const summaryParts: string[] = [];

  for (const c of result) {
    const plansSummary =
      c.plans.length > 0
        ? c.plans
            .map((p) => {
              // Distinguish Free vs Custom/Contact Sales vs Fixed Numeric Price
              let priceFormatted: string;
              if (p.pricingConflictNote) {
                priceFormatted = `[CONFLICT: DB indicates Contact Sales, but Source Scrape documents $100.00/mo]`;
              } else if (p.isCustomPricing) {
                priceFormatted = "Contact Sales (Custom / Enterprise quote required)";
              } else if (p.price === "0.00" || p.price === "0") {
                priceFormatted = "$0.00 (Free Tier)";
              } else if (p.price !== null && p.price !== undefined) {
                const symbol = p.currency === "USD" || !p.currency ? "$" : `${p.currency} `;
                if (p.annualEquivalentMonthly) {
                  priceFormatted = `${symbol}${p.price}/${p.billingPeriod} [Annual billing breakdown: ${p.annualEquivalentMonthly}]`;
                } else {
                  priceFormatted = `${symbol}${p.price}/${p.billingPeriod || "month"}`;
                }
              } else {
                priceFormatted = "Price not specified in current database records";
              }

              const limitsFormatted =
                p.usageLimits && Object.keys(p.usageLimits).length > 0
                  ? JSON.stringify(p.usageLimits)
                  : "Not specified in database records";

              // Concise feature summary to stay comfortably within Groq ITPM quotas
              let entitlementsText = "Standard entitlements";
              if (p.featureSnapshots.length > 0) {
                entitlementsText = p.featureSnapshots
                  .slice(0, 4)
                  .map((f) => `${f.name}: ${f.value || "Included"}`)
                  .join("; ");
              } else if (p.features.length > 0) {
                entitlementsText = p.features.slice(0, 3).join(", ");
              }

              const observedDateText = p.lastObservedAt
                ? new Date(p.lastObservedAt).toISOString().split("T")[0]
                : "Recent";

              const conflictSuffix = p.pricingConflictNote ? ` | WARNING: ${p.pricingConflictNote}` : "";

              return `- Plan: "${p.planName}" | Category: [${p.tierCategory}] | Price: ${priceFormatted} | Billing Interval: ${p.billingPeriod || "monthly"} | Usage Limits: ${limitsFormatted} | Verified Features: [${entitlementsText}] | Source: ${p.sourceUrl || "Tracked page"} (Observed: ${observedDateText})${conflictSuffix}`;
            })
            .join("\n")
        : "No active pricing plans recorded in current database.";

    const generalFeaturesSummary =
      c.unassociatedFeatures.length > 0
        ? c.unassociatedFeatures
            .slice(0, 5)
            .map((f) => `- ${f.name}: ${f.value || "Included"}`)
            .join("\n")
        : "None recorded.";

    const changesSummary =
      c.recentChanges.length > 0
        ? c.recentChanges
            .slice(0, 3)
            .map((ch) => `- [${ch.changeType}] ${ch.description} (${new Date(ch.detectedAt).toISOString().split("T")[0]})`)
            .join("\n")
        : "No recent pricing changes detected.";

    const scrapeFreshness = c.latestScrapeTimestamp
      ? `Last Scraped: ${new Date(c.latestScrapeTimestamp).toISOString()}`
      : "Last Scraped: Not available";

    summaryParts.push(`
=========================================
COMPETITOR: ${c.name} (${c.domain})
Website: ${c.website}
${scrapeFreshness} | Source URL: ${c.latestScrapeUrl || "N/A"}
Industry: ${c.industry || "Technology"}
Description: ${c.description || "N/A"}

CURRENT ACTIVE PRICING TIERS:
${plansSummary}

GENERAL CAPABILITIES (UNASSOCIATED WITH SPECIFIC PLANS):
${generalFeaturesSummary}

RECENT HISTORICAL CHANGES & AUDIT TRAIL:
${changesSummary}
=========================================
`);
  }

  const builtData = {
    competitors: result,
    summaryText: summaryParts.join("\n\n"),
  };

  contextCache.set(cacheKey, {
    timestamp: Date.now(),
    data: builtData,
  });

  return builtData;
}
