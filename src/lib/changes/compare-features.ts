import { SnapshotPlan, DetectedChange } from "./types";

/**
 * Normalizes feature name string for conservative comparison
 */
export function normalizeFeatureName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

/**
 * Compares features of two plan snapshots and detects added, removed, and availability shifts.
 */
export function comparePlanFeatures(
  competitorId: string,
  previous: SnapshotPlan,
  current: SnapshotPlan
): DetectedChange[] {
  const changes: DetectedChange[] = [];
  const planId = current.pricingPlanId || previous.pricingPlanId || null;
  const prevSnapId = previous.id || null;
  const currSnapId = current.id || null;
  const sourceUrl = current.sourceUrl || previous.sourceUrl || null;

  const prevFeatures = previous.features || [];
  const currFeatures = current.features || [];

  const prevMap = new Map<string, string>();
  for (const f of prevFeatures) {
    prevMap.set(normalizeFeatureName(f), f);
  }

  const currMap = new Map<string, string>();
  for (const f of currFeatures) {
    currMap.set(normalizeFeatureName(f), f);
  }

  // Feature Added
  for (const [norm, orig] of currMap.entries()) {
    if (!prevMap.has(norm)) {
      changes.push({
        competitorId,
        pricingPlanId: planId,
        previousSnapshotId: prevSnapId,
        currentSnapshotId: currSnapId,
        changeType: "FEATURE_ADDED",
        fieldName: "features",
        oldValue: null,
        newValue: orig,
        description: `Plan "${current.planName}" added feature: "${orig}".`,
        sourceUrl,
      });
    }
  }

  // Feature Removed
  for (const [norm, orig] of prevMap.entries()) {
    if (!currMap.has(norm)) {
      changes.push({
        competitorId,
        pricingPlanId: planId,
        previousSnapshotId: prevSnapId,
        currentSnapshotId: currSnapId,
        changeType: "FEATURE_REMOVED",
        fieldName: "features",
        oldValue: orig,
        newValue: null,
        description: `Plan "${current.planName}" removed feature: "${orig}".`,
        sourceUrl,
      });
    }
  }

  return changes;
}
