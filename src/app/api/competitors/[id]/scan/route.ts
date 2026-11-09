import { NextRequest } from "next/server";
import { uuidSchema } from "@/schemas/api";
import { scrapeCompetitor } from "@/lib/scraping/scrape-competitor";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/competitors/[id]/scan
 * Scans all active URLs for a competitor.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const competitorId = uuidSchema.parse(id);

    const summary = await scrapeCompetitor(competitorId);

    return successResponse(summary);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Competitor not found")) {
      return errorResponse(err.message, 404);
    }
    return handleApiError(err);
  }
}
