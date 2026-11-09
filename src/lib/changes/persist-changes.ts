import { db, pricingChanges } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { DetectedChange } from "./types";

/**
 * Persists detected changes idempotently using database queries.
 * Prevents duplicate change records if the same snapshot pair is compared again.
 */
export async function persistDetectedChanges(
  changes: DetectedChange[]
): Promise<{ insertedCount: number; skippedCount: number; records: any[] }> {
  if (changes.length === 0) {
    return { insertedCount: 0, skippedCount: 0, records: [] };
  }

  const insertedRecords: any[] = [];
  let skippedCount = 0;

  for (const change of changes) {
    // Check for existing duplicate change event
    const existing = await db.query.pricingChanges.findFirst({
      where: and(
        eq(pricingChanges.competitorId, change.competitorId),
        change.pricingPlanId
          ? eq(pricingChanges.pricingPlanId, change.pricingPlanId)
          : undefined,
        change.previousSnapshotId
          ? eq(pricingChanges.previousSnapshotId, change.previousSnapshotId)
          : undefined,
        change.currentSnapshotId
          ? eq(pricingChanges.currentSnapshotId, change.currentSnapshotId)
          : undefined,
        eq(pricingChanges.changeType, change.changeType),
        change.fieldName ? eq(pricingChanges.fieldName, change.fieldName) : undefined
      ),
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    try {
      const [inserted] = await db
        .insert(pricingChanges)
        .values({
          competitorId: change.competitorId,
          pricingPlanId: change.pricingPlanId || null,
          previousSnapshotId: change.previousSnapshotId || null,
          currentSnapshotId: change.currentSnapshotId || null,
          changeType: change.changeType,
          fieldName: change.fieldName || null,
          oldValue: change.oldValue,
          newValue: change.newValue,
          absoluteDifference: change.absoluteDifference || null,
          percentageDifference: change.percentageDifference || null,
          description: change.description,
          sourceUrl: change.sourceUrl || null,
          detectedAt: change.detectedAt || new Date(),
        })
        .returning();

      insertedRecords.push(inserted);
    } catch (err: any) {
      // Catch unique index collisions gracefully
      if (err?.code === "23505") {
        skippedCount++;
      } else {
        throw err;
      }
    }
  }

  return {
    insertedCount: insertedRecords.length,
    skippedCount,
    records: insertedRecords,
  };
}
