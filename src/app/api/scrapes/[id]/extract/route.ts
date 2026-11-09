import { NextRequest } from "next/server";
import { uuidSchema } from "@/schemas/api";
import { executeExtractionForScrape } from "@/lib/ai/extraction/pipeline";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/scrapes/[id]/extract
 * Extracts pricing plans & features from a single scrape result.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const scrapeId = uuidSchema.parse(id);

    const result = await executeExtractionForScrape(scrapeId);

    return successResponse(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("not found")) {
      return errorResponse(err.message, 404);
    }
    if (err instanceof Error && err.message.includes("already in progress")) {
      return errorResponse(err.message, 409);
    }
    return handleApiError(err);
  }
}
