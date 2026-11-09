import { NextRequest } from "next/server";
import { db, competitors, scrapeResults, trackedUrls } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { uuidSchema } from "@/schemas/api";
import { executeExtractionForScrape, ExtractionExecutionResult } from "@/lib/ai/extraction/pipeline";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/competitors/[id]/extract
 * Runs LLM extraction on recent successful scrape results of a competitor.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const competitorId = uuidSchema.parse(id);

    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    });

    if (!competitor) {
      return errorResponse("Competitor not found", 404);
    }

    // Fetch up to 3 most recent successful scrape results
    const recentScrapes = await db.query.scrapeResults.findMany({
      where: (t, { and, eq }) =>
        and(eq(t.competitorId, competitorId), eq(t.status, "SUCCESS")),
      orderBy: [desc(scrapeResults.scrapedAt)],
      limit: 3,
    });

    if (recentScrapes.length === 0) {
      return errorResponse(
        "No successful scrapes found for this competitor. Run a scan first before extracting.",
        400
      );
    }

    const results: ExtractionExecutionResult[] = [];
    for (const scrape of recentScrapes) {
      try {
        const out = await executeExtractionForScrape(scrape.id);
        results.push(out);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Extraction failed";

        // Persist FAILED status on tracked URL
        if (scrape.trackedUrlId) {
          await db
            .update(trackedUrls)
            .set({
              lastExtractionStatus: "FAILED",
              lastExtractedAt: new Date(),
              lastExtractionError: errMsg,
              lastExtractedPlanCount: "0",
              lastExtractedFeatureCount: "0",
              updatedAt: new Date(),
            })
            .where(eq(trackedUrls.id, scrape.trackedUrlId));
        }

        results.push({
          scrapeId: scrape.id,
          competitorId,
          status: "FAILED",
          extractedPlanCount: 0,
          extractedFeatureCount: 0,
          detectedChangesCount: 0,
          errorMessage: errMsg,
          plans: [],
        });
      }
    }

    const totalPlans = results.reduce((acc, r) => acc + r.extractedPlanCount, 0);
    const totalFeatures = results.reduce((acc, r) => acc + r.extractedFeatureCount, 0);

    return successResponse({
      competitorId,
      competitorName: competitor.name,
      scrapesProcessed: recentScrapes.length,
      totalPlansExtracted: totalPlans,
      totalFeaturesExtracted: totalFeatures,
      results,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
