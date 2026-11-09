import { SnapshotPlan, DetectedChange } from "./types";

/**
 * Compares two snapshots of the same plan and detects price/currency/billing/custom pricing shifts.
 * Uses decimal-safe integer cent arithmetic.
 */
export function comparePlanPricing(
  competitorId: string,
  previous: SnapshotPlan,
  current: SnapshotPlan
): DetectedChange[] {
  const changes: DetectedChange[] = [];
  const planId = current.pricingPlanId || previous.pricingPlanId || null;
  const prevSnapId = previous.id || null;
  const currSnapId = current.id || null;
  const sourceUrl = current.sourceUrl || previous.sourceUrl || null;

  const prevHasPrice = previous.price !== null && previous.price !== undefined;
  const currHasPrice = current.price !== null && current.price !== undefined;

  // 1. Custom Pricing Introduced / Removed (checked before billing period to handle "custom" billing period transitions)
  if (prevHasPrice && !currHasPrice) {
    changes.push({
      competitorId,
      pricingPlanId: planId,
      previousSnapshotId: prevSnapId,
      currentSnapshotId: currSnapId,
      changeType: "CUSTOM_PRICING_INTRODUCED",
      fieldName: "price",
      oldValue: previous.price,
      newValue: null,
      description: `Plan "${current.planName}" switched from $${previous.price} to custom contact-sales pricing.`,
      sourceUrl,
    });
    return changes;
  }

  if (!prevHasPrice && currHasPrice) {
    changes.push({
      competitorId,
      pricingPlanId: planId,
      previousSnapshotId: prevSnapId,
      currentSnapshotId: currSnapId,
      changeType: "CUSTOM_PRICING_REMOVED",
      fieldName: "price",
      oldValue: null,
      newValue: current.price,
      description: `Plan "${current.planName}" introduced public pricing of $${current.price} (previously custom).`,
      sourceUrl,
    });
    return changes;
  }

  // 2. Currency Change
  if (previous.currency && current.currency && previous.currency !== current.currency) {
    changes.push({
      competitorId,
      pricingPlanId: planId,
      previousSnapshotId: prevSnapId,
      currentSnapshotId: currSnapId,
      changeType: "CURRENCY_CHANGED",
      fieldName: "currency",
      oldValue: previous.currency,
      newValue: current.currency,
      description: `Plan "${current.planName}" currency changed from ${previous.currency} to ${current.currency}.`,
      sourceUrl,
    });
    return changes;
  }

  // 3. Billing Period Change
  if (
    previous.billingPeriod &&
    current.billingPeriod &&
    previous.billingPeriod !== current.billingPeriod
  ) {
    changes.push({
      competitorId,
      pricingPlanId: planId,
      previousSnapshotId: prevSnapId,
      currentSnapshotId: currSnapId,
      changeType: "BILLING_PERIOD_CHANGED",
      fieldName: "billing_period",
      oldValue: previous.billingPeriod,
      newValue: current.billingPeriod,
      description: `Plan "${current.planName}" billing period changed from ${previous.billingPeriod} to ${current.billingPeriod}.`,
      sourceUrl,
    });
    return changes;
  }

  if (prevHasPrice && currHasPrice) {
    // Decimal-safe integer cents parsing
    const prevCents = Math.round(parseFloat(previous.price!) * 100);
    const currCents = Math.round(parseFloat(current.price!) * 100);

    // 4. Free plan transitions
    if (prevCents > 0 && currCents === 0) {
      changes.push({
        competitorId,
        pricingPlanId: planId,
        previousSnapshotId: prevSnapId,
        currentSnapshotId: currSnapId,
        changeType: "PRICE_BECAME_FREE",
        fieldName: "price",
        oldValue: previous.price,
        newValue: "0.00",
        absoluteDifference: (-(prevCents / 100)).toFixed(2),
        percentageDifference: "-100.00",
        description: `Plan "${current.planName}" became free (previously $${previous.price}).`,
        sourceUrl,
      });
      return changes;
    }

    if (prevCents === 0 && currCents > 0) {
      changes.push({
        competitorId,
        pricingPlanId: planId,
        previousSnapshotId: prevSnapId,
        currentSnapshotId: currSnapId,
        changeType: "PRICE_NO_LONGER_FREE",
        fieldName: "price",
        oldValue: "0.00",
        newValue: current.price,
        absoluteDifference: (currCents / 100).toFixed(2),
        percentageDifference: null,
        description: `Plan "${current.planName}" introduced paywall of $${current.price} (previously free).`,
        sourceUrl,
      });
      return changes;
    }

    // 5. Price Increases / Decreases
    const diffCents = currCents - prevCents;

    if (diffCents > 0) {
      const absDiff = (diffCents / 100).toFixed(2);
      const pctDiff = prevCents > 0 ? (((currCents - prevCents) / prevCents) * 100).toFixed(2) : null;

      changes.push({
        competitorId,
        pricingPlanId: planId,
        previousSnapshotId: prevSnapId,
        currentSnapshotId: currSnapId,
        changeType: "PRICE_INCREASED",
        fieldName: "price",
        oldValue: previous.price,
        newValue: current.price,
        absoluteDifference: absDiff,
        percentageDifference: pctDiff,
        description: `Plan "${current.planName}" increased from $${previous.price} to $${current.price} (+${pctDiff}%).`,
        sourceUrl,
      });
    } else if (diffCents < 0) {
      const absDiff = (diffCents / 100).toFixed(2);
      const pctDiff = prevCents > 0 ? (((currCents - prevCents) / prevCents) * 100).toFixed(2) : null;

      changes.push({
        competitorId,
        pricingPlanId: planId,
        previousSnapshotId: prevSnapId,
        currentSnapshotId: currSnapId,
        changeType: "PRICE_DECREASED",
        fieldName: "price",
        oldValue: previous.price,
        newValue: current.price,
        absoluteDifference: absDiff,
        percentageDifference: pctDiff,
        description: `Plan "${current.planName}" decreased from $${previous.price} to $${current.price} (${pctDiff}%).`,
        sourceUrl,
      });
    }
  }

  return changes;
}
