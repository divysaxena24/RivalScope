import { NextRequest } from "next/server";
import { runGlobalFeatureReExtraction } from "@/lib/monitoring/global-re-extraction";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

/**
 * POST /api/dashboard/sync-features
 * Triggers a universal global feature re-extraction and matrix synchronization across all active competitors.
 */
export async function POST(req: NextRequest) {
  try {
    const outcome = await runGlobalFeatureReExtraction({
      batchSize: 20,
      force: true,
    });

    return successResponse({
      message: "Global competitor feature re-extraction completed successfully",
      result: outcome,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
