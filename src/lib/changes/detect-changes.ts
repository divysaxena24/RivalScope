import { SnapshotPlan, DetectedChange } from "./types";
import { matchPlans } from "./match-plans";
import { comparePlanPricing } from "./compare-plans";
import { comparePlanFeatures } from "./compare-features";
import { comparePlanUsageLimits } from "./compare-limits";

export interface DetectChangesOptions {
  competitorId: string;
  previousPlans: SnapshotPlan[];
  currentPlans: SnapshotPlan[];
  isCompleteExtraction?: boolean; // Only detect removals if extraction is complete and verified
}

/**
 * Orchestrates deterministic change detection between previous snapshot set and new snapshot set.
 */
export function detectChangesBetweenSnapshots(
  options: DetectChangesOptions
): DetectedChange[] {
  const { competitorId, previousPlans, currentPlans, isCompleteExtraction = true } = options;
  const changes: DetectedChange[] = [];

  // If there are no previous snapshots at all, this is the first baseline extraction -> 0 changes.
  if (previousPlans.length === 0) {
    return [];
  }

  const { matched, added, removed } = matchPlans(previousPlans, currentPlans);

  // 1. Matched plans: compare pricing, features, and usage limits
  for (const { previous, current } of matched) {
    const priceChanges = comparePlanPricing(competitorId, previous, current);
    const featureChanges = comparePlanFeatures(competitorId, previous, current);
    const limitChanges = comparePlanUsageLimits(competitorId, previous, current);

    changes.push(...priceChanges, ...featureChanges, ...limitChanges);
  }

  // 2. Newly added plans
  for (const add of added) {
    changes.push({
      competitorId,
      pricingPlanId: add.pricingPlanId || null,
      previousSnapshotId: null,
      currentSnapshotId: add.id || null,
      changeType: "PLAN_ADDED",
      fieldName: "plan_name",
      oldValue: null,
      newValue: {
        planName: add.planName,
        price: add.price,
        currency: add.currency,
        billingPeriod: add.billingPeriod,
      },
      description: `New plan "${add.planName}" added${add.price ? ` at $${add.price}/${add.billingPeriod || "mo"}` : ""}.`,
      sourceUrl: add.sourceUrl || null,
    });
  }

  // 3. Removed plans (strictly only when extraction is verified complete, never on partial/failed/flagged crawls)
  if (isCompleteExtraction) {
    for (const rem of removed) {
      changes.push({
        competitorId,
        pricingPlanId: rem.pricingPlanId || null,
        previousSnapshotId: rem.id || null,
        currentSnapshotId: null,
        changeType: "PLAN_REMOVED",
        fieldName: "plan_name",
        oldValue: {
          planName: rem.planName,
          price: rem.price,
          currency: rem.currency,
          billingPeriod: rem.billingPeriod,
        },
        newValue: null,
        description: `Plan "${rem.planName}" was discontinued or removed from public pricing table.`,
        sourceUrl: rem.sourceUrl || null,
      });
    }
  }

  return changes;
}
