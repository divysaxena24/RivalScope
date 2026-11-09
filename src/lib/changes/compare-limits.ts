import { SnapshotPlan, DetectedChange } from "./types";

/**
 * Extracts numeric value and unit from limit strings (e.g., "10 users" -> { val: 10, unit: "users" })
 */
export function parseLimitQuantity(raw: unknown): { val: number; unit: string } | null {
  if (typeof raw === "number") {
    return { val: raw, unit: "" };
  }
  if (typeof raw === "string") {
    const match = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/.exec(raw.trim());
    if (match) {
      return { val: parseFloat(match[1]), unit: match[2].toLowerCase() };
    }
  }
  return null;
}

/**
 * Compares usage limits between two plan snapshots and detects increase/decrease only when units are compatible.
 */
export function comparePlanUsageLimits(
  competitorId: string,
  previous: SnapshotPlan,
  current: SnapshotPlan
): DetectedChange[] {
  const changes: DetectedChange[] = [];
  const planId = current.pricingPlanId || previous.pricingPlanId || null;
  const prevSnapId = previous.id || null;
  const currSnapId = current.id || null;
  const sourceUrl = current.sourceUrl || previous.sourceUrl || null;

  const prevLimits = previous.usageLimits || {};
  const currLimits = current.usageLimits || {};

  const allKeys = new Set([...Object.keys(prevLimits), ...Object.keys(currLimits)]);

  for (const key of allKeys) {
    const prevVal = prevLimits[key];
    const currVal = currLimits[key];

    if (prevVal === undefined && currVal !== undefined) {
      changes.push({
        competitorId,
        pricingPlanId: planId,
        previousSnapshotId: prevSnapId,
        currentSnapshotId: currSnapId,
        changeType: "LIMIT_INCREASED",
        fieldName: `usage_limits.${key}`,
        oldValue: null,
        newValue: currVal,
        description: `Plan "${current.planName}" introduced limit on ${key}: ${currVal}.`,
        sourceUrl,
      });
      continue;
    }

    if (prevVal !== undefined && currVal === undefined) {
      changes.push({
        competitorId,
        pricingPlanId: planId,
        previousSnapshotId: prevSnapId,
        currentSnapshotId: currSnapId,
        changeType: "LIMIT_DECREASED",
        fieldName: `usage_limits.${key}`,
        oldValue: prevVal,
        newValue: null,
        description: `Plan "${current.planName}" removed limit on ${key}.`,
        sourceUrl,
      });
      continue;
    }

    if (prevVal !== currVal) {
      const prevQty = parseLimitQuantity(prevVal);
      const currQty = parseLimitQuantity(currVal);

      // Compare only when units are compatible
      if (prevQty && currQty && prevQty.unit === currQty.unit) {
        if (currQty.val > prevQty.val) {
          changes.push({
            competitorId,
            pricingPlanId: planId,
            previousSnapshotId: prevSnapId,
            currentSnapshotId: currSnapId,
            changeType: "LIMIT_INCREASED",
            fieldName: `usage_limits.${key}`,
            oldValue: prevVal,
            newValue: currVal,
            description: `Plan "${current.planName}" increased ${key} limit from ${prevVal} to ${currVal}.`,
            sourceUrl,
          });
        } else if (currQty.val < prevQty.val) {
          changes.push({
            competitorId,
            pricingPlanId: planId,
            previousSnapshotId: prevSnapId,
            currentSnapshotId: currSnapId,
            changeType: "LIMIT_DECREASED",
            fieldName: `usage_limits.${key}`,
            oldValue: prevVal,
            newValue: currVal,
            description: `Plan "${current.planName}" lowered ${key} limit from ${prevVal} to ${currVal}.`,
            sourceUrl,
          });
        }
      } else {
        // Generic limit adjustment when units are non-numeric or incompatible
        changes.push({
          competitorId,
          pricingPlanId: planId,
          previousSnapshotId: prevSnapId,
          currentSnapshotId: currSnapId,
          changeType: "LIMIT_DECREASED",
          fieldName: `usage_limits.${key}`,
          oldValue: prevVal,
          newValue: currVal,
          description: `Plan "${current.planName}" modified ${key} limit from "${prevVal}" to "${currVal}".`,
          sourceUrl,
        });
      }
    }
  }

  return changes;
}
