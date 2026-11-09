import { NextRequest } from "next/server";
import { uuidSchema } from "@/schemas/api";
import { scrapeTrackedUrl } from "@/lib/scraping/scrape-tracked-url";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tracked-urls/[id]/scan
 * Scans one tracked URL.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const trackedUrlId = uuidSchema.parse(id);

    const outcome = await scrapeTrackedUrl(trackedUrlId);

    return successResponse(outcome);
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
