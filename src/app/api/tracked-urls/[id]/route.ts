import { NextRequest } from "next/server";
import { db, trackedUrls } from "@/lib/db";
import { eq } from "drizzle-orm";
import { uuidSchema } from "@/schemas/api";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/tracked-urls/[id]
 * Removes a tracked page URL.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const urlId = uuidSchema.parse(id);

    const [deleted] = await db
      .delete(trackedUrls)
      .where(eq(trackedUrls.id, urlId))
      .returning();

    if (!deleted) {
      return errorResponse("Tracked URL not found", 404);
    }

    return successResponse({
      message: "Tracked URL removed successfully",
      deletedId: deleted.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
