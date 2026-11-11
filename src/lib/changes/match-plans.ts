import { SnapshotPlan } from "./types";

/**
 * Normalizes plan names for conservative matching (e.g., "Team Pro" <-> "team pro", "Pro Plan" <-> "Pro")
 */
export function normalizePlanName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+(tier|plan|package|edition)$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Matches plans between previous snapshot observations and new snapshot observations.
 * Returns matched pairs, newly added plans, and missing/removed plans.
 */
export function matchPlans(
  previousPlans: SnapshotPlan[],
  currentPlans: SnapshotPlan[]
): {
  matched: Array<{ previous: SnapshotPlan; current: SnapshotPlan }>;
  added: SnapshotPlan[];
  removed: SnapshotPlan[];
} {
  const matched: Array<{ previous: SnapshotPlan; current: SnapshotPlan }> = [];
  const added: SnapshotPlan[] = [];
  const usedPrevIndices = new Set<number>();

  for (const curr of currentPlans) {
    const currNorm = normalizePlanName(curr.planName);
    let matchedIdx = -1;

    // 1. Direct planId match if available
    if (curr.pricingPlanId) {
      matchedIdx = previousPlans.findIndex(
        (p, idx) => !usedPrevIndices.has(idx) && p.pricingPlanId === curr.pricingPlanId
      );
    }

    // 2. Exact or normalized name match WITH billing period check:
    // Only attempt name match if curr does NOT already have an explicit pricingPlanId that differed from previous plans
    if (matchedIdx === -1 && !curr.pricingPlanId) {
      matchedIdx = previousPlans.findIndex((p, idx) => {
        if (usedPrevIndices.has(idx)) return false;
        const nameMatches = normalizePlanName(p.planName) === currNorm;
        if (!nameMatches) return false;
        // If both specify billing periods and they differ (e.g. monthly vs yearly), do not match
        if (p.billingPeriod && curr.billingPeriod && p.billingPeriod !== curr.billingPeriod) {
          return false;
        }
        return true;
      });
    }

    if (matchedIdx !== -1) {
      usedPrevIndices.add(matchedIdx);
      matched.push({
        previous: previousPlans[matchedIdx],
        current: curr,
      });
    } else {
      added.push(curr);
    }
  }

  const removed = previousPlans.filter((_, idx) => !usedPrevIndices.has(idx));

  return { matched, added, removed };
}
