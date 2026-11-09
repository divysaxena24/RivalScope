import { db, competitors, pricingPlans, pricingChanges, scrapeResults } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { CompetitorIntelligenceContext, MarketWideIntelligenceContext } from "./types";

/**
 * Gathers grounded, verified structured context for a specific competitor.
 */
export async function buildCompetitorIntelligenceContext(
  competitorId: string
): Promise<CompetitorIntelligenceContext | null> {
  const comp = await db.query.competitors.findFirst({
    where: eq(competitors.id, competitorId),
    with: {
      pricingPlans: {
        where: eq(pricingPlans.isActive, true),
      },
    },
  });

  if (!comp) return null;

  // Recent changes
  const changes = await db.query.pricingChanges.findMany({
    where: eq(pricingChanges.competitorId, competitorId),
    orderBy: [desc(pricingChanges.detectedAt)],
    limit: 20,
  });

  // Recent scrapes
  const scrapes = await db.query.scrapeResults.findMany({
    where: (t, { and, eq }) =>
      and(eq(t.competitorId, competitorId), eq(t.status, "SUCCESS")),
    orderBy: [desc(scrapeResults.scrapedAt)],
    limit: 3,
  });

  return {
    competitorId: comp.id,
    competitorName: comp.name,
    domain: comp.domain,
    industry: comp.industry,
    activePlans: comp.pricingPlans.map((p) => ({
      id: p.id,
      planName: p.planName,
      price: p.price,
      currency: p.currency,
      billingPeriod: p.billingPeriod,
      features: p.features || [],
      usageLimits: p.usageLimits || {},
    })),
    recentChanges: changes.map((c) => ({
      id: c.id,
      changeType: c.changeType,
      fieldName: c.fieldName,
      oldValue: c.oldValue,
      newValue: c.newValue,
      percentageDifference: c.percentageDifference,
      description: c.description,
      detectedAt: c.detectedAt,
    })),
    recentScrapes: scrapes.map((s) => ({
      id: s.id,
      sourceUrl: s.sourceUrl,
      pageTitle: s.pageTitle,
      scrapedAt: s.scrapedAt,
      contentSnippet: s.markdownContent ? s.markdownContent.slice(0, 1500) : "",
    })),
  };
}

/**
 * Gathers portfolio-wide market intelligence context across all tracked competitors.
 */
export async function buildMarketWideIntelligenceContext(): Promise<MarketWideIntelligenceContext> {
  const allCompetitors = await db.query.competitors.findMany({
    with: {
      pricingPlans: true,
    },
  });

  const competitorContexts: CompetitorIntelligenceContext[] = [];
  let totalChanges = 0;

  for (const c of allCompetitors) {
    const single = await buildCompetitorIntelligenceContext(c.id);
    if (single) {
      competitorContexts.push(single);
      totalChanges += single.recentChanges.length;
    }
  }

  const totalPlans = competitorContexts.reduce(
    (acc, curr) => acc + curr.activePlans.length,
    0
  );

  return {
    competitors: competitorContexts,
    totalCompetitorsTracked: competitorContexts.length,
    totalPlansTracked: totalPlans,
    totalChangesInWindow: totalChanges,
  };
}
