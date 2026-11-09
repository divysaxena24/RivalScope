import { NextRequest } from "next/server";
import { db, scrapeResults } from "@/lib/db";
import { eq } from "drizzle-orm";
import { uuidSchema } from "@/schemas/api";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/scrapes/[id]
 * Retrieves one full scraping result, including complete markdown content.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const scrapeId = uuidSchema.parse(id);

    const result = await db.query.scrapeResults.findFirst({
      where: eq(scrapeResults.id, scrapeId),
      with: {
        competitor: true,
        trackedUrl: true,
      },
    });

    if (!result) {
      return errorResponse("Scrape result not found", 404);
    }

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
