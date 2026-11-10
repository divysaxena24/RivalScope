import { db } from "@/lib/db";
import { competitors, pricingPlans, featureSnapshots, pricingChanges, scrapeResults } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";

export interface GroundedCompetitorData {
  id: string;
  name: string;
  domain: string;
  website: string;
  industry: string | null;
  description: string | null;
  plans: Array<{
    id: string;
    planName: string;
    price: string | null;
    currency: string | null;
    billingPeriod: string | null;
    isCustomPricing: boolean;
    features: string[];
    usageLimits: Record<string, unknown>;
  }>;
  features: Array<{
    featureName: string;
    featureValue: string | null;
    sourceUrl: string | null;
    observedAt: Date;
  }>;
  recentChanges: Array<{
    changeType: string;
    fieldName: string | null;
    oldValue: unknown;
    newValue: unknown;
    description: string | null;
    detectedAt: Date;
  }>;
}

/**
 * Builds grounded knowledge base for selected competitor IDs (or all active competitors).
 */
export async function buildChatbotCompetitorContext(
  competitorIds?: string[]
): Promise<{
  competitors: GroundedCompetitorData[];
  summaryText: string;
}> {
  // 1. Fetch competitors
  let compQuery = db.select().from(competitors).where(eq(competitors.status, "active"));
  if (competitorIds && competitorIds.length > 0 && !competitorIds.includes("all")) {
    compQuery = db
      .select()
      .from(competitors)
      .where(inArray(competitors.id, competitorIds));
  }

  const activeComps = await compQuery;
  const result: GroundedCompetitorData[] = [];

  for (const comp of activeComps) {
    // Plans
    const plans = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.competitorId, comp.id));

    // Latest unique feature snapshots
    const feats = await db
      .select({
        featureName: featureSnapshots.featureName,
        featureValue: featureSnapshots.featureValue,
        sourceUrl: featureSnapshots.sourceUrl,
        observedAt: featureSnapshots.observedAt,
      })
      .from(featureSnapshots)
      .where(eq(featureSnapshots.competitorId, comp.id))
      .orderBy(desc(featureSnapshots.observedAt))
      .limit(60);

    // Deduplicate latest by featureName
    const featMap = new Map<string, typeof feats[0]>();
    for (const f of feats) {
      const lower = f.featureName.toLowerCase().trim();
      if (!featMap.has(lower)) {
        featMap.set(lower, f);
      }
    }

    // Recent pricing and packaging changes
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
      .where(eq(pricingChanges.competitorId, comp.id))
      .orderBy(desc(pricingChanges.detectedAt))
      .limit(10);

    result.push({
      id: comp.id,
      name: comp.name,
      domain: comp.domain,
      website: comp.website,
      industry: comp.industry,
      description: comp.description,
      plans: plans.map((p) => ({
        id: p.id,
        planName: p.planName,
        price: p.price,
        currency: p.currency,
        billingPeriod: p.billingPeriod,
        isCustomPricing: p.isCustomPricing,
        features: (p.features as string[]) || [],
        usageLimits: (p.usageLimits as Record<string, unknown>) || {},
      })),
      features: Array.from(featMap.values()),
      recentChanges: changes,
    });
  }

  // Format concise, grounded text block for LLM prompt injection
  const summaryParts: string[] = [];

  for (const c of result) {
    const plansSummary = c.plans.length > 0
      ? c.plans
          .map(
            (p) =>
              `- Plan: "${p.planName}" | Price: ${p.isCustomPricing ? "Custom/Enterprise" : p.price ? `${p.currency || "$"}${p.price}/${p.billingPeriod || "mo"}` : "Free"} | Usage Limits: ${JSON.stringify(p.usageLimits)}`
          )
          .join("\n")
      : "No active plans recorded yet.";

    const featuresSummary = c.features.length > 0
      ? c.features
          .slice(0, 30)
          .map((f) => `- ${f.featureName}: ${f.featureValue || "Included"}`)
          .join("\n")
      : "No feature snapshots recorded.";

    const changesSummary = c.recentChanges.length > 0
      ? c.recentChanges
          .map((ch) => `- [${ch.changeType}] ${ch.description}`)
          .join("\n")
      : "No recent pricing changes detected.";

    summaryParts.push(`
=========================================
COMPETITOR: ${c.name} (${c.domain})
Industry: ${c.industry || "Technology"}
Description: ${c.description || "N/A"}

ACTIVE PRICING TIERS:
${plansSummary}

FEATURE & CAPABILITY MATRIX SNAPSHOTS:
${featuresSummary}

RECENT HISTORICAL CHANGES & MOVEMENTS:
${changesSummary}
=========================================
`);
  }

  return {
    competitors: result,
    summaryText: summaryParts.join("\n\n"),
  };
}
