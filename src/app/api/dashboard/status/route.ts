import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  competitors,
  trackedUrls,
  scrapeResults,
  pricingPlans,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { successResponse, errorResponse, handleApiError } from "@/lib/api/response";

const StatusQuerySchema = z.object({
  competitorId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = StatusQuerySchema.parse(searchParams);

    if (query.competitorId) {
      // Competitor specific status
      const [comp] = await db
        .select()
        .from(competitors)
        .where(eq(competitors.id, query.competitorId))
        .limit(1);

      if (!comp) {
        return errorResponse("Competitor not found", "NOT_FOUND", 404);
      }

      const urls = await db
        .select({
          id: trackedUrls.id,
          url: trackedUrls.url,
          pageType: trackedUrls.pageType,
          isActive: trackedUrls.isActive,
          lastScannedAt: trackedUrls.lastScannedAt,
          lastScanStatus: trackedUrls.lastScanStatus,
        })
        .from(trackedUrls)
        .where(eq(trackedUrls.competitorId, query.competitorId));

      const [latestScrape] = await db
        .select({
          id: scrapeResults.id,
          status: scrapeResults.status,
          errorMessage: scrapeResults.errorMessage,
          scrapedAt: scrapeResults.scrapedAt,
          sourceUrl: scrapeResults.sourceUrl,
        })
        .from(scrapeResults)
        .where(eq(scrapeResults.competitorId, query.competitorId))
        .orderBy(desc(scrapeResults.scrapedAt))
        .limit(1);

      const [planStats] = await db
        .select({
          planCount: sql<number>`count(*)::int`,
          lastExtractedAt: sql<Date | null>`max(${pricingPlans.updatedAt})`,
        })
        .from(pricingPlans)
        .where(eq(pricingPlans.competitorId, query.competitorId));

      return successResponse({
        competitorId: comp.id,
        competitorName: comp.name,
        trackedUrls: urls,
        lastScan: latestScrape
          ? {
              scrapeId: latestScrape.id,
              status: latestScrape.status,
              errorMessage: latestScrape.errorMessage,
              scrapedAt: latestScrape.scrapedAt.toISOString(),
              sourceUrl: latestScrape.sourceUrl,
            }
          : null,
        extraction: {
          activePlansCount: planStats?.planCount ?? 0,
          lastExtractedAt: planStats?.lastExtractedAt
            ? planStats.lastExtractedAt.toISOString()
            : null,
        },
      });
    }

    // Global pipeline status overview
    const [latestScrape] = await db
      .select({
        id: scrapeResults.id,
        status: scrapeResults.status,
        errorMessage: scrapeResults.errorMessage,
        scrapedAt: scrapeResults.scrapedAt,
        sourceUrl: scrapeResults.sourceUrl,
      })
      .from(scrapeResults)
      .orderBy(desc(scrapeResults.scrapedAt))
      .limit(1);

    const [urlsAgg] = await db
      .select({
        totalUrls: sql<number>`count(*)::int`,
        successful: sql<number>`count(case when ${trackedUrls.lastScanStatus} = 'success' then 1 end)::int`,
        failed: sql<number>`count(case when ${trackedUrls.lastScanStatus} = 'failed' then 1 end)::int`,
        pending: sql<number>`count(case when ${trackedUrls.lastScanStatus} is null then 1 end)::int`,
      })
      .from(trackedUrls);

    return successResponse({
      systemStatus: "healthy",
      lastScrapeEvent: latestScrape
        ? {
            status: latestScrape.status,
            errorMessage: latestScrape.errorMessage,
            scrapedAt: latestScrape.scrapedAt.toISOString(),
            sourceUrl: latestScrape.sourceUrl,
          }
        : null,
      urlsDistribution: urlsAgg,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
