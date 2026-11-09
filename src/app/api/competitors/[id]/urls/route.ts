import { NextRequest } from "next/server";
import { db, competitors, trackedUrls } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { uuidSchema, createTrackedUrlSchema } from "@/schemas/api";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/competitors/[id]/urls
 * List all tracked URLs for a specific competitor.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const competitorId = uuidSchema.parse(id);

    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    });

    if (!competitor) {
      return errorResponse("Competitor not found", 404);
    }

    const urls = await db.query.trackedUrls.findMany({
      where: eq(trackedUrls.competitorId, competitorId),
      orderBy: [desc(trackedUrls.createdAt)],
    });

    return successResponse(urls);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/competitors/[id]/urls
 * Add a new page URL to monitor for this competitor.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const competitorId = uuidSchema.parse(id);
    const body = await req.json();
    const validated = createTrackedUrlSchema.parse(body);

    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    });

    if (!competitor) {
      return errorResponse("Competitor not found", 404);
    }

    // Check for duplicate URL for this competitor
    const existingUrl = await db.query.trackedUrls.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.competitorId, competitorId), eq(t.url, validated.url.trim())),
    });

    if (existingUrl) {
      return errorResponse(
        "This URL is already registered for this competitor.",
        409
      );
    }

    const [newUrl] = await db
      .insert(trackedUrls)
      .values({
        competitorId,
        url: validated.url.trim(),
        pageType: validated.pageType,
        isActive: validated.isActive,
      })
      .returning();

    return successResponse(newUrl, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
