import { NextRequest } from "next/server";
import { db, competitors, pricingSnapshots } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { uuidSchema } from "@/schemas/api";
import { SnapshotPlan } from "@/lib/changes/types";
import { detectChangesBetweenSnapshots } from "@/lib/changes/detect-changes";
import { persistDetectedChanges } from "@/lib/changes/persist-changes";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/competitors/[id]/detect-changes
 * Safely re-runs change detection across historical snapshot sets without creating new snapshots.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const competitorId = uuidSchema.parse(id);

    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    });

    if (!competitor) {
      return errorResponse("Competitor not found", 404);
    }

    // Load all historical snapshots ordered by timestamp descending
    const allSnapshots = await db.query.pricingSnapshots.findMany({
      where: eq(pricingSnapshots.competitorId, competitorId),
      orderBy: [desc(pricingSnapshots.observedAt)],
    });

    if (allSnapshots.length === 0) {
      return successResponse({
        competitorId,
        message: "No snapshots exist to compare.",
        changesDetected: 0,
      });
    }

    // Group snapshots by observation timestamp
    const timeBatches = new Map<string, typeof allSnapshots>();
    for (const snap of allSnapshots) {
      const timeKey = new Date(snap.observedAt).toISOString();
      if (!timeBatches.has(timeKey)) {
        timeBatches.set(timeKey, []);
      }
      timeBatches.get(timeKey)!.push(snap);
    }

    const batchKeys = Array.from(timeBatches.keys());

    if (batchKeys.length < 2) {
      return successResponse({
        competitorId,
        message: "Only one snapshot batch exists (baseline established). Needs at least two batches for diffing.",
        changesDetected: 0,
      });
    }

    // Compare the newest batch with the previous batch
    const currentBatch = timeBatches.get(batchKeys[0])!;
    const previousBatch = timeBatches.get(batchKeys[1])!;

    const currentPlans: SnapshotPlan[] = currentBatch.map((s) => ({
      id: s.id,
      pricingPlanId: s.pricingPlanId,
      planName: s.planName,
      price: s.price,
      currency: s.currency,
      billingPeriod: s.billingPeriod,
      features: s.features,
      usageLimits: s.usageLimits,
      sourceUrl: s.sourceUrl,
      observedAt: s.observedAt,
    }));

    const previousPlans: SnapshotPlan[] = previousBatch.map((s) => ({
      id: s.id,
      pricingPlanId: s.pricingPlanId,
      planName: s.planName,
      price: s.price,
      currency: s.currency,
      billingPeriod: s.billingPeriod,
      features: s.features,
      usageLimits: s.usageLimits,
      sourceUrl: s.sourceUrl,
      observedAt: s.observedAt,
    }));

    const detected = detectChangesBetweenSnapshots({
      competitorId,
      previousPlans,
      currentPlans,
      isCompleteExtraction: true,
    });

    const persistResult = await persistDetectedChanges(detected);

    return successResponse({
      competitorId,
      comparedBatches: {
        currentTimestamp: batchKeys[0],
        previousTimestamp: batchKeys[1],
      },
      detectedCount: detected.length,
      insertedCount: persistResult.insertedCount,
      skippedDuplicates: persistResult.skippedCount,
      changes: persistResult.records,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
