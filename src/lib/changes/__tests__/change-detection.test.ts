import { describe, it, expect } from "vitest";
import { matchPlans } from "../match-plans";
import { comparePlanPricing } from "../compare-plans";
import { comparePlanFeatures } from "../compare-features";
import { comparePlanUsageLimits } from "../compare-limits";
import { detectChangesBetweenSnapshots } from "../detect-changes";
import { SnapshotPlan } from "../types";

describe("Historical Diffing & Change Detection Engine Tests", () => {
  const competitorId = "comp-test-123";

  it("1. First extraction creates no change events (baseline)", () => {
    const current: SnapshotPlan[] = [
      {
        pricingPlanId: "plan-1",
        planName: "Pro",
        price: "29.00",
        currency: "USD",
        billingPeriod: "monthly",
        features: ["Feature A"],
        usageLimits: { seats: "5" },
      },
    ];

    const changes = detectChangesBetweenSnapshots({
      competitorId,
      previousPlans: [],
      currentPlans: current,
    });

    expect(changes.length).toBe(0);
  });

  it("2. Price increase detection with exact percentage", () => {
    const prev: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Pro",
      price: "40.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: {},
    };
    const curr: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Pro",
      price: "50.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: {},
    };

    const changes = comparePlanPricing(competitorId, prev, curr);
    expect(changes.length).toBe(1);
    expect(changes[0].changeType).toBe("PRICE_INCREASED");
    expect(changes[0].absoluteDifference).toBe("10.00");
    expect(changes[0].percentageDifference).toBe("25.00");
  });

  it("3. Price decrease detection with exact percentage", () => {
    const prev: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Pro",
      price: "100.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: {},
    };
    const curr: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Pro",
      price: "80.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: {},
    };

    const changes = comparePlanPricing(competitorId, prev, curr);
    expect(changes.length).toBe(1);
    expect(changes[0].changeType).toBe("PRICE_DECREASED");
    expect(changes[0].absoluteDifference).toBe("-20.00");
    expect(changes[0].percentageDifference).toBe("-20.00");
  });

  it("4. Free plan transition (price became free & no longer free)", () => {
    const paid: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Starter",
      price: "15.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: {},
    };
    const free: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Starter",
      price: "0.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: {},
    };

    const becameFree = comparePlanPricing(competitorId, paid, free);
    expect(becameFree[0].changeType).toBe("PRICE_BECAME_FREE");

    const noLongerFree = comparePlanPricing(competitorId, free, paid);
    expect(noLongerFree[0].changeType).toBe("PRICE_NO_LONGER_FREE");
  });

  it("5. Custom pricing transition (introduced & removed)", () => {
    const fixed: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Enterprise",
      price: "500.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: {},
    };
    const custom: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Enterprise",
      price: null,
      currency: "USD",
      billingPeriod: "custom",
      features: [],
      usageLimits: {},
    };

    const customIntroduced = comparePlanPricing(competitorId, fixed, custom);
    expect(customIntroduced[0].changeType).toBe("CUSTOM_PRICING_INTRODUCED");

    const customRemoved = comparePlanPricing(competitorId, custom, fixed);
    expect(customRemoved[0].changeType).toBe("CUSTOM_PRICING_REMOVED");
  });

  it("6. Currency mismatch handling prevents false price difference calculation", () => {
    const usd: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Pro",
      price: "50.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: {},
    };
    const inr: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Pro",
      price: "4000.00",
      currency: "INR",
      billingPeriod: "monthly",
      features: [],
      usageLimits: {},
    };

    const changes = comparePlanPricing(competitorId, usd, inr);
    expect(changes.length).toBe(1);
    expect(changes[0].changeType).toBe("CURRENCY_CHANGED");
    expect(changes[0].absoluteDifference).toBeUndefined();
  });

  it("7. Billing period mismatch (annual vs monthly) prevents false hike detection", () => {
    const monthly: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Pro",
      price: "20.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: {},
    };
    const yearly: SnapshotPlan = {
      pricingPlanId: "plan-1",
      planName: "Pro",
      price: "200.00",
      currency: "USD",
      billingPeriod: "yearly",
      features: [],
      usageLimits: {},
    };

    const changes = comparePlanPricing(competitorId, monthly, yearly);
    expect(changes.length).toBe(1);
    expect(changes[0].changeType).toBe("BILLING_PERIOD_CHANGED");
    expect(changes[0].absoluteDifference).toBeUndefined();
  });

  it("8. Plan addition detection", () => {
    const prev: SnapshotPlan[] = [
      { planName: "Free", price: "0.00", currency: "USD", billingPeriod: "monthly", features: [], usageLimits: {} },
    ];
    const curr: SnapshotPlan[] = [
      { planName: "Free", price: "0.00", currency: "USD", billingPeriod: "monthly", features: [], usageLimits: {} },
      { planName: "Pro", price: "29.00", currency: "USD", billingPeriod: "monthly", features: [], usageLimits: {} },
    ];

    const changes = detectChangesBetweenSnapshots({
      competitorId,
      previousPlans: prev,
      currentPlans: curr,
      isCompleteExtraction: true,
    });

    const added = changes.filter((c) => c.changeType === "PLAN_ADDED");
    expect(added.length).toBe(1);
    expect(added[0].description).toContain('New plan "Pro" added');
  });

  it("9. Plan removal only occurs when extraction is marked complete", () => {
    const prev: SnapshotPlan[] = [
      { planName: "Free", price: "0.00", currency: "USD", billingPeriod: "monthly", features: [], usageLimits: {} },
      { planName: "Pro", price: "29.00", currency: "USD", billingPeriod: "monthly", features: [], usageLimits: {} },
    ];
    const partial: SnapshotPlan[] = [
      { planName: "Free", price: "0.00", currency: "USD", billingPeriod: "monthly", features: [], usageLimits: {} },
    ];

    // If partial extraction / incomplete -> 0 removals
    const partialChanges = detectChangesBetweenSnapshots({
      competitorId,
      previousPlans: prev,
      currentPlans: partial,
      isCompleteExtraction: false,
    });
    expect(partialChanges.some((c) => c.changeType === "PLAN_REMOVED")).toBe(false);

    // If verified complete extraction -> 1 removal
    const completeChanges = detectChangesBetweenSnapshots({
      competitorId,
      previousPlans: prev,
      currentPlans: partial,
      isCompleteExtraction: true,
    });
    expect(completeChanges.some((c) => c.changeType === "PLAN_REMOVED")).toBe(true);
  });

  it("10. Feature addition and removal detection", () => {
    const prev: SnapshotPlan = {
      planName: "Pro",
      price: "29.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: ["Custom Domain", "SSO SAML"],
      usageLimits: {},
    };
    const curr: SnapshotPlan = {
      planName: "Pro",
      price: "29.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: ["Custom Domain", "Audit Logs"],
      usageLimits: {},
    };

    const changes = comparePlanFeatures(competitorId, prev, curr);
    expect(changes.some((c) => c.changeType === "FEATURE_ADDED" && c.newValue === "Audit Logs")).toBe(true);
    expect(changes.some((c) => c.changeType === "FEATURE_REMOVED" && c.oldValue === "SSO SAML")).toBe(true);
  });

  it("11. Usage limit increase and decrease with compatible units", () => {
    const prev: SnapshotPlan = {
      planName: "Pro",
      price: "29.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: { seats: "5 users", storage: "50 gb" },
    };
    const curr: SnapshotPlan = {
      planName: "Pro",
      price: "29.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: { seats: "10 users", storage: "20 gb" },
    };

    const changes = comparePlanUsageLimits(competitorId, prev, curr);
    expect(changes.some((c) => c.changeType === "LIMIT_INCREASED" && c.fieldName === "usage_limits.seats")).toBe(true);
    expect(changes.some((c) => c.changeType === "LIMIT_DECREASED" && c.fieldName === "usage_limits.storage")).toBe(true);
  });

  it("12. Incompatible usage units are handled safely without false quantity math", () => {
    const prev: SnapshotPlan = {
      planName: "Pro",
      price: "29.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: { quota: "50 requests" },
    };
    const curr: SnapshotPlan = {
      planName: "Pro",
      price: "29.00",
      currency: "USD",
      billingPeriod: "monthly",
      features: [],
      usageLimits: { quota: "10 gb" },
    };

    const changes = comparePlanUsageLimits(competitorId, prev, curr);
    expect(changes.length).toBe(1);
    expect(changes[0].description).toContain("modified quota limit from \"50 requests\" to \"10 gb\"");
  });
});
