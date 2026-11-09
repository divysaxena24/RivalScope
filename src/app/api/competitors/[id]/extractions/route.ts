import { NextRequest } from "next/server";
import { db, competitors, pricingPlans, pricingSnapshots, featureSnapshots } from "@/lib/db";
import { eq, desc, count } from "drizzle-orm";
import { uuidSchema } from "@/schemas/api";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/competitors/[id]/extractions
 * Returns current extracted plans, snapshot history count, and feature count.
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
      orderBy: [desc(pricingPlans.updatedAt)],
    });

    const [snapshotCount] = await db
      .select({ value: count() })
      .from(pricingSnapshots)
      .where(eq(pricingSnapshots.competitorId, competitorId));

    const [featureCount] = await db
      .select({ value: count() })
      .from(featureSnapshots)
      .where(eq(featureSnapshots.competitorId, competitorId));

    return successResponse({
      competitorId,
      plans,
      totalSnapshotsRecorded: snapshotCount?.value || 0,
      totalFeaturesRecorded: featureCount?.value || 0,
      lastExtractionAt: plans[0]?.updatedAt || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
