import { NextRequest } from "next/server";
import { db, competitors, pricingChanges } from "@/lib/db";
import { eq, desc, and, gte, lte, count } from "drizzle-orm";
import { uuidSchema } from "@/schemas/api";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/competitors/[id]/changes
 * Returns paginated, filtered change records for a competitor.
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

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    const changeType = searchParams.get("changeType");
    const planId = searchParams.get("planId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const conditions = [eq(pricingChanges.competitorId, competitorId)];

    if (changeType) {
      conditions.push(eq(pricingChanges.changeType, changeType));
    }
    if (planId) {
      conditions.push(eq(pricingChanges.pricingPlanId, planId));
    }
    if (startDate) {
      conditions.push(gte(pricingChanges.detectedAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(pricingChanges.detectedAt, new Date(endDate)));
    }

    const whereClause = and(...conditions);

    const [totalRecord] = await db
      .select({ value: count() })
      .from(pricingChanges)
      .where(whereClause);

    const total = totalRecord?.value || 0;

    const changes = await db.query.pricingChanges.findMany({
      where: whereClause,
      orderBy: [desc(pricingChanges.detectedAt)],
      limit,
      offset,
      with: {
        pricingPlan: true,
      },
    });

    return successResponse({
      changes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
