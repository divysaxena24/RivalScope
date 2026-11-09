import { NextRequest } from "next/server";
import { db, competitors, pricingPlans } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { uuidSchema } from "@/schemas/api";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/competitors/[id]/plans
 * Returns all pricing plans for a competitor.
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

    const plans = await db.query.pricingPlans.findMany({
      where: eq(pricingPlans.competitorId, competitorId),
      orderBy: [desc(pricingPlans.createdAt)],
    });

    return successResponse(plans);
  } catch (error) {
    return handleApiError(error);
  }
}
