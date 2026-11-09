import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  competitors,
  trackedUrls,
  pricingPlans,
  pricingChanges,
  aiInsights,
  scrapeResults,
} from "@/lib/db/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { successResponse, handleApiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    // 1. Total competitors
    const [compCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(competitors);

    // 2. Tracked URLs: total, active, successful scans, failed scans
    const [urlsMetrics] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(case when ${trackedUrls.isActive} = true then 1 end)::int`,
        successfulScans: sql<number>`count(case when ${trackedUrls.lastScanStatus} = 'success' then 1 end)::int`,
        failedScans: sql<number>`count(case when ${trackedUrls.lastScanStatus} = 'failed' then 1 end)::int`,
      })
      .from(trackedUrls);

    // 3. Pricing plans: active plans count
    const [plansMetrics] = await db
      .select({
        totalPlans: sql<number>`count(*)::int`,
        activePlans: sql<number>`count(case when ${pricingPlans.isActive} = true then 1 end)::int`,
        customPricingPlans: sql<number>`count(case when ${pricingPlans.isCustomPricing} = true then 1 end)::int`,
      })
      .from(pricingPlans);

    // 4. Detected changes: price increases, price decreases, total recent changes
    // Time window: last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [changesMetrics] = await db
      .select({
        totalChanges: sql<number>`count(*)::int`,
        priceIncreases: sql<number>`count(case when upper(${pricingChanges.changeType}) in ('PRICE_INCREASED', 'PRICE_NO_LONGER_FREE') then 1 end)::int`,
        priceDecreases: sql<number>`count(case when upper(${pricingChanges.changeType}) in ('PRICE_DECREASED', 'PRICE_BECAME_FREE') then 1 end)::int`,
        planAdditions: sql<number>`count(case when upper(${pricingChanges.changeType}) = 'PLAN_ADDED' then 1 end)::int`,
        featureUpdates: sql<number>`count(case when upper(${pricingChanges.changeType}) like 'FEATURE_%' or upper(${pricingChanges.changeType}) like 'LIMIT_%' then 1 end)::int`,
      })
      .from(pricingChanges)
      .where(gte(pricingChanges.detectedAt, thirtyDaysAgo));

    const priceHikes = changesMetrics?.priceIncreases ?? 0;
    const priceDrops = changesMetrics?.priceDecreases ?? 0;
    const totalQualifyingPriceChanges = priceHikes + priceDrops;

    // 5. AI Insights: total and high-impact
    const [insightsMetrics] = await db
      .select({
        totalInsights: sql<number>`count(*)::int`,
        highImpactInsights: sql<number>`count(case when ${aiInsights.impact} = 'high' then 1 end)::int`,
      })
      .from(aiInsights);

    // 6. Latest scan timestamp
    const [latestScan] = await db
      .select({ scrapedAt: scrapeResults.scrapedAt })
      .from(scrapeResults)
      .orderBy(desc(scrapeResults.scrapedAt))
      .limit(1);

    // 7. Latest successful extraction timestamp
    const [latestExtraction] = await db
      .select({ observedAt: pricingPlans.updatedAt })
      .from(pricingPlans)
      .orderBy(desc(pricingPlans.updatedAt))
      .limit(1);

    const overview = {
      metrics: {
        totalCompetitors: compCount?.count ?? 0,
        trackedUrls: {
          total: urlsMetrics?.total ?? 0,
          active: urlsMetrics?.active ?? 0,
          successfulScans: urlsMetrics?.successfulScans ?? 0,
          failedScans: urlsMetrics?.failedScans ?? 0,
        },
        pricingPlans: {
          total: plansMetrics?.totalPlans ?? 0,
          active: plansMetrics?.activePlans ?? 0,
          customPricing: plansMetrics?.customPricingPlans ?? 0,
        },
        changesLast30Days: {
          total: totalQualifyingPriceChanges,
          allEventsTotal: changesMetrics?.totalChanges ?? 0,
          priceIncreases: priceHikes,
          priceDecreases: priceDrops,
          planAdditions: changesMetrics?.planAdditions ?? 0,
          featureUpdates: changesMetrics?.featureUpdates ?? 0,
        },
        insights: {
          total: insightsMetrics?.totalInsights ?? 0,
          highPriority: insightsMetrics?.highImpactInsights ?? 0,
        },
      },
      timestamps: {
        latestScanAt: latestScan?.scrapedAt ? latestScan.scrapedAt.toISOString() : null,
        latestExtractionAt: latestExtraction?.observedAt ? latestExtraction.observedAt.toISOString() : null,
      },
      timeWindows: {
        recentChangesWindowDays: 30,
      },
    };

    return successResponse(overview);
  } catch (error) {
    return handleApiError(error);
  }
}
