import { NextRequest } from "next/server";
import { uuidSchema } from "@/schemas/api";
import { runScrapeAndExtractPipeline } from "@/lib/ai/extraction/full-pipeline";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/competitors/[id]/pipeline
 * Executes combined crawler scrape + Groq pricing extraction.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const competitorId = uuidSchema.parse(id);

    const result = await runScrapeAndExtractPipeline(competitorId);

    return successResponse(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("not found")) {
      return errorResponse(err.message, 404);
    }
    return handleApiError(err);
  }
}
