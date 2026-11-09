import { NextRequest } from "next/server";
import { db, competitors, scrapeResults } from "@/lib/db";
import { eq, desc, count, and } from "drizzle-orm";
import { uuidSchema } from "@/schemas/api";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/competitors/[id]/scrapes
 * Returns paginated scraping history, with latest successful scrape and previous weekly observation.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const competitorId = uuidSchema.parse(id);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const offset = (page - 1) * limit;
    const statusFilter = searchParams.get("status"); // "SUCCESS", "FAILED", or all
    const trackedUrlIdParam = searchParams.get("trackedUrlId");

    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    });

    if (!competitor) {
      return errorResponse("Competitor not found", 404);
    }

    // Filter conditions for history query
    const whereConditions: any[] = [eq(scrapeResults.competitorId, competitorId)];
    if (statusFilter && (statusFilter === "SUCCESS" || statusFilter === "FAILED")) {
      whereConditions.push(eq(scrapeResults.status, statusFilter));
    }
    if (trackedUrlIdParam) {
      whereConditions.push(eq(scrapeResults.trackedUrlId, trackedUrlIdParam));
    }

    const [totalRecord] = await db
      .select({ value: count() })
      .from(scrapeResults)
      .where(and(...whereConditions));

    const total = totalRecord?.value || 0;

    // 1. Exclude raw markdownContent from listing to keep payloads light
    const history = await db.query.scrapeResults.findMany({
      where: and(...whereConditions),
      orderBy: [desc(scrapeResults.scrapedAt)],
      limit,
      offset,
      columns: {
        id: true,
        competitorId: true,
        trackedUrlId: true,
        sourceUrl: true,
        pageTitle: true,
        contentHash: true,
        status: true,
        errorMessage: true,
        scrapedAt: true,
        metadata: true,
      },
      with: {
        trackedUrl: {
          columns: {
            id: true,
            pageType: true,
          },
        },
      },
    });

    // 2. Compute Latest Successful Scrape and Previous Weekly Observation
    // We query all successful scrapes ordered desc to find:
    // a) latest successful scrape
    // b) the scrape directly preceding the latest (to compute whether contentChanged)
    // c) latest successful scrape at or before the 7-day lookback target
    const successfulScrapes = await db.query.scrapeResults.findMany({
      where: and(
        eq(scrapeResults.competitorId, competitorId),
        eq(scrapeResults.status, "SUCCESS"),
        trackedUrlIdParam ? eq(scrapeResults.trackedUrlId, trackedUrlIdParam) : undefined
      ),
      orderBy: [desc(scrapeResults.scrapedAt)],
      limit: 100, // sufficient depth to find 7-day lookback target
      columns: {
        id: true,
        competitorId: true,
        trackedUrlId: true,
        sourceUrl: true,
        pageTitle: true,
        contentHash: true,
        status: true,
        scrapedAt: true,
        metadata: true,
      },
    });

    let latestSuccessful: any = null;
    let previousWeekly: any = null;

    if (successfulScrapes.length > 0) {
      const latest = successfulScrapes[0];
      const preceding = successfulScrapes[1] || null;

      latestSuccessful = {
        ...latest,
        contentChanged: preceding ? preceding.contentHash !== latest.contentHash : false,
        precedingScrapedAt: preceding?.scrapedAt || null,
      };

      // 7-day lookback target from latest scrape timestamp (or now)
      const targetTime = new Date(latest.scrapedAt).getTime() - 7 * 24 * 60 * 60 * 1000;

      // Find the latest successful observation at or before the 7-day lookback target
      const eligibleWeekly = successfulScrapes.find(
        (s) => new Date(s.scrapedAt).getTime() <= targetTime
      );

      if (eligibleWeekly) {
        previousWeekly = {
          ...eligibleWeekly,
          contentChangedFromLatest: eligibleWeekly.contentHash !== latest.contentHash,
          daysAgo: Math.round(
            (new Date(latest.scrapedAt).getTime() - new Date(eligibleWeekly.scrapedAt).getTime()) /
              (24 * 60 * 60 * 1000)
          ),
        };
      }
    }

    return successResponse({
      summary: {
        latestSuccessful,
        previousWeekly,
      },
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
