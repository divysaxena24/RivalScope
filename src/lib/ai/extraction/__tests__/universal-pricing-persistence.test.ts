import { describe, it, expect } from "vitest";
import { mergeExtractionPasses } from "../merge-extractions";
import { normalizePricingPlan, normalizeExtractionResult } from "../normalize-pricing";
import { NormalizedExtractionResult, ExtractedPricingPlan } from "../types";
import { matchPlans } from "../../../changes/match-plans";
import { SnapshotPlan } from "../../../changes/types";

describe("Universal Pricing Plan Persistence & Display Consistency Tests", () => {
  // Requirement 9.1: One competitor with two plans
  it("1. handles one competitor with two plans cleanly", () => {
    const rawResult: NormalizedExtractionResult = {
      companyName: "TwoPlanCo",
      productName: "Suite",
      currency: "USD",
      region: "US",
      status: "SUCCESS",
      rawPlanCount: 2,
      featureCount: 2,
      modelExtractedCount: 2,
      validatedCount: 2,
      plans: [
        {
          planName: "Basic",
          description: "Basic tier",
          price: "10.00",
          currency: "USD",
          region: "US",
          billingPeriod: "monthly",
          isCustomPricing: false,
          isActive: true,
          isFree: false,
          originalPriceText: "$10/mo",
          discountInfo: null,
          features: [{ name: "Feature A", description: null, availability: "included", originalValue: "Yes", numericLimit: null, limitUnit: null, limitationDescription: null, evidenceText: null }],
          usageLimits: {},
          targetSegment: null,
          evidenceText: "Basic is $10",
        },
        {
          planName: "Pro",
          description: "Pro tier",
          price: "30.00",
          currency: "USD",
          region: "US",
          billingPeriod: "monthly",
          isCustomPricing: false,
          isActive: true,
          isFree: false,
          originalPriceText: "$30/mo",
          discountInfo: null,
          features: [{ name: "Feature B", description: null, availability: "included", originalValue: "Yes", numericLimit: null, limitUnit: null, limitationDescription: null, evidenceText: null }],
          usageLimits: {},
          targetSegment: null,
          evidenceText: "Pro is $30",
        },
      ],
    };

    const merged = mergeExtractionPasses([rawResult]);
    expect(merged.plans).toHaveLength(2);
    expect(merged.plans.map((p) => p.planName)).toEqual(["Basic", "Pro"]);
  });

  // Requirement 9.2: One competitor with six or more plans
  it("2. handles one competitor with six or more distinct plans without truncation", () => {
    const sixPlans: ExtractedPricingPlan[] = [
      { planName: "Free", price: 0, isFree: true, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$0", billingPeriod: "monthly", features: [], evidenceText: "Free" },
      { planName: "Pro", price: 10, isFree: false, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$10/mo", billingPeriod: "monthly", features: [], evidenceText: "Pro" },
      { planName: "Pro+", price: 39, isFree: false, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$39/mo", billingPeriod: "monthly", features: [], evidenceText: "Pro+" },
      { planName: "Max", price: 100, isFree: false, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$100/mo", billingPeriod: "monthly", features: [], evidenceText: "Max" },
      { planName: "Business", price: 19, isFree: false, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$19/user/mo", billingPeriod: "monthly", features: [], evidenceText: "Business" },
      { planName: "Enterprise", price: null, isFree: false, isCustomPricing: true, isPubliclyAvailable: true, originalPriceText: "Contact Sales", billingPeriod: "custom", features: [], evidenceText: "Enterprise" },
    ];

    const normalized = normalizeExtractionResult({
      hasPricing: true,
      status: "SUCCESS",
      currency: "USD",
      confidenceScore: 1,
      plans: sixPlans,
    });

    expect(normalized.plans).toHaveLength(6);
    expect(normalized.modelExtractedCount).toBe(6);
    expect(normalized.validatedCount).toBe(6);
    expect(normalized.plans.map((p) => p.planName)).toEqual([
      "Free",
      "Pro",
      "Pro+",
      "Max",
      "Business",
      "Enterprise",
    ]);
  });

  // Requirement 9.3: Multiple extraction chunks containing different plans
  it("3. merges multiple extraction chunks containing different plans without loss", () => {
    const chunk1: NormalizedExtractionResult = {
      companyName: "MultiChunkCorp",
      productName: null,
      currency: "USD",
      region: null,
      status: "SUCCESS",
      rawPlanCount: 2,
      featureCount: 0,
      plans: [
        { planName: "Free", description: null, price: "0.00", currency: "USD", region: null, billingPeriod: "monthly", isCustomPricing: false, isActive: true, isFree: true, originalPriceText: "$0", discountInfo: null, features: [], usageLimits: {}, targetSegment: null, evidenceText: "Free" },
        { planName: "Pro", description: null, price: "10.00", currency: "USD", region: null, billingPeriod: "monthly", isCustomPricing: false, isActive: true, isFree: false, originalPriceText: "$10", discountInfo: null, features: [], usageLimits: {}, targetSegment: null, evidenceText: "Pro" },
      ],
    };

    const chunk2: NormalizedExtractionResult = {
      companyName: "MultiChunkCorp",
      productName: null,
      currency: "USD",
      region: null,
      status: "SUCCESS",
      rawPlanCount: 2,
      featureCount: 0,
      plans: [
        { planName: "Pro+", description: null, price: "39.00", currency: "USD", region: null, billingPeriod: "monthly", isCustomPricing: false, isActive: true, isFree: false, originalPriceText: "$39", discountInfo: null, features: [], usageLimits: {}, targetSegment: null, evidenceText: "Pro+" },
        { planName: "Max", description: null, price: "100.00", currency: "USD", region: null, billingPeriod: "monthly", isCustomPricing: false, isActive: true, isFree: false, originalPriceText: "$100", discountInfo: null, features: [], usageLimits: {}, targetSegment: null, evidenceText: "Max" },
      ],
    };

    const merged = mergeExtractionPasses([chunk1, chunk2]);
    expect(merged.plans).toHaveLength(4);
    expect(merged.plans.map((p) => p.planName)).toEqual(["Free", "Pro", "Pro+", "Max"]);
    expect(merged.modelExtractedCount).toBe(4);
    expect(merged.validatedCount).toBe(4);
  });

  // Requirement 9.4: Duplicate plans across chunks
  it("4. deduplicates genuinely identical plans appearing across chunks", () => {
    const chunk1: NormalizedExtractionResult = {
      companyName: "DupCorp",
      productName: null,
      currency: "USD",
      region: null,
      status: "SUCCESS",
      rawPlanCount: 1,
      featureCount: 1,
      plans: [
        { planName: "Pro", description: null, price: "20.00", currency: "USD", region: null, billingPeriod: "monthly", isCustomPricing: false, isActive: true, isFree: false, originalPriceText: "$20/mo", discountInfo: null, features: [{ name: "Feature 1", description: null, availability: "included", originalValue: "Yes", numericLimit: null, limitUnit: null, limitationDescription: null, evidenceText: null }], usageLimits: {}, targetSegment: null, evidenceText: "Pro $20" },
      ],
    };

    const chunk2: NormalizedExtractionResult = {
      companyName: "DupCorp",
      productName: null,
      currency: "USD",
      region: null,
      status: "SUCCESS",
      rawPlanCount: 1,
      featureCount: 1,
      plans: [
        { planName: "Pro", description: "Updated description", price: "20.00", currency: "USD", region: null, billingPeriod: "monthly", isCustomPricing: false, isActive: true, isFree: false, originalPriceText: "$20/mo", discountInfo: null, features: [{ name: "Feature 2", description: null, availability: "included", originalValue: "Yes", numericLimit: null, limitUnit: null, limitationDescription: null, evidenceText: null }], usageLimits: {}, targetSegment: null, evidenceText: "Pro $20" },
      ],
    };

    const merged = mergeExtractionPasses([chunk1, chunk2]);
    expect(merged.plans).toHaveLength(1);
    expect(merged.plans[0].planName).toBe("Pro");
    expect(merged.plans[0].features).toHaveLength(2); // Features merged cleanly
  });

  // Requirement 9.5: Similar names representing distinct offerings
  it("5. preserves distinct offerings even when names are similar (e.g. Pro vs Pro+ vs Max)", () => {
    const plans: ExtractedPricingPlan[] = [
      { planName: "Pro", price: 10, isFree: false, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$10", billingPeriod: "monthly", features: [], evidenceText: "Pro" },
      { planName: "Pro+", price: 39, isFree: false, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$39", billingPeriod: "monthly", features: [], evidenceText: "Pro+" },
      { planName: "Pro Max", price: 99, isFree: false, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$99", billingPeriod: "monthly", features: [], evidenceText: "Pro Max" },
    ];

    const normalized = normalizeExtractionResult({
      hasPricing: true,
      status: "SUCCESS",
      currency: "USD",
      confidenceScore: 1,
      plans,
    });

    const merged = mergeExtractionPasses([normalized]);
    expect(merged.plans).toHaveLength(3);
    expect(merged.plans.map((p) => p.planName)).toEqual(["Pro", "Pro+", "Pro Max"]);
  });

  // Requirement 9.6: Monthly and annual variants
  it("6. preserves monthly and annual variants as distinct offerings", () => {
    const plans: ExtractedPricingPlan[] = [
      { planName: "Developer", price: 15, isFree: false, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$15/mo", billingPeriod: "monthly", features: [], evidenceText: "Dev monthly" },
      { planName: "Developer", price: 150, isFree: false, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$150/yr", billingPeriod: "yearly", features: [], evidenceText: "Dev yearly" },
    ];

    const normalized = normalizeExtractionResult({
      hasPricing: true,
      status: "SUCCESS",
      currency: "USD",
      confidenceScore: 1,
      plans,
    });

    const merged = mergeExtractionPasses([normalized]);
    expect(merged.plans).toHaveLength(2);
    expect(merged.plans[0].billingPeriod).toBe("monthly");
    expect(merged.plans[1].billingPeriod).toBe("yearly");
    expect(merged.plans[0].price).toBe("15.00");
    expect(merged.plans[1].price).toBe("150.00");
  });

  // Requirement 9.7: Multiple currencies and regions
  it("7. preserves multiple currencies and regional offerings without forced default to USD", () => {
    const rawEUR: ExtractedPricingPlan = {
      planName: "Euro Business",
      price: 25,
      currency: "EUR",
      region: "EU",
      billingPeriod: "monthly",
      isCustomPricing: false,
      isFree: false,
      isPubliclyAvailable: true,
      originalPriceText: "€25/mo",
      features: [],
      evidenceText: "Euro 25",
    };

    const rawINR: ExtractedPricingPlan = {
      planName: "India Tier",
      price: 1950,
      currency: "INR",
      region: "IN",
      billingPeriod: "monthly",
      isCustomPricing: false,
      isFree: false,
      isPubliclyAvailable: true,
      originalPriceText: "₹1,950/mo",
      features: [],
      evidenceText: "INR 1950",
    };

    const normEUR = normalizePricingPlan(rawEUR, null);
    const normINR = normalizePricingPlan(rawINR, null);

    expect(normEUR.currency).toBe("EUR");
    expect(normEUR.region).toBe("EU");
    expect(normINR.currency).toBe("INR");
    expect(normINR.region).toBe("IN");
  });

  // Requirement 9.8: Free, paid, team, and enterprise plans
  it("8. preserves free, paid, team, and enterprise tiers accurately", () => {
    const plans: ExtractedPricingPlan[] = [
      { planName: "Starter Free", price: 0, isFree: true, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$0", billingPeriod: "monthly", features: [], evidenceText: "Free" },
      { planName: "Team", price: 25, isFree: false, isCustomPricing: false, isPubliclyAvailable: true, originalPriceText: "$25/seat", billingPeriod: "monthly", features: [], evidenceText: "Team" },
      { planName: "Enterprise", price: null, isFree: false, isCustomPricing: true, isPubliclyAvailable: true, originalPriceText: "Talk to Sales", billingPeriod: "custom", features: [], evidenceText: "Custom" },
    ];

    const normalized = normalizeExtractionResult({
      hasPricing: true,
      status: "SUCCESS",
      currency: "USD",
      confidenceScore: 1,
      plans,
    });

    expect(normalized.plans[0].isFree).toBe(true);
    expect(normalized.plans[0].price).toBe("0.00");
    expect(normalized.plans[1].price).toBe("25.00");
    expect(normalized.plans[2].isCustomPricing).toBe(true);
    expect(normalized.plans[2].price).toBeNull();
  });

  // Requirement 9.9: Missing prices and unknown currencies
  it("9. does not invent missing prices or default unknown currencies to USD", () => {
    const raw: ExtractedPricingPlan = {
      planName: "Secret Tier",
      price: null,
      currency: null,
      region: null,
      billingPeriod: "unknown",
      isCustomPricing: false,
      isFree: false,
      isPubliclyAvailable: true,
      originalPriceText: "Price upon request",
      features: [],
      evidenceText: "Secret Tier",
    };

    const normalized = normalizePricingPlan(raw, null, null);
    expect(normalized.price).toBeNull();
    expect(normalized.currency).toBeNull(); // Untouched, never forced to USD
  });

  // Requirement 9.10: Incomplete extraction after previously complete extraction
  it("10. prevents partial extraction from blindly replacing a richer existing dataset", () => {
    const previousCompletePlans: SnapshotPlan[] = [
      { id: "p1", pricingPlanId: "p1", planName: "Free", price: "0.00", currency: "USD", billingPeriod: "monthly", features: ["F1", "F2"], usageLimits: {} },
      { id: "p2", pricingPlanId: "p2", planName: "Pro", price: "10.00", currency: "USD", billingPeriod: "monthly", features: ["F1", "F2"], usageLimits: {} },
      { id: "p3", pricingPlanId: "p3", planName: "Pro+", price: "39.00", currency: "USD", billingPeriod: "monthly", features: ["F1", "F2"], usageLimits: {} },
      { id: "p4", pricingPlanId: "p4", planName: "Max", price: "100.00", currency: "USD", billingPeriod: "monthly", features: ["F1", "F2"], usageLimits: {} },
    ];

    const currentPartialPlans: SnapshotPlan[] = [
      { id: "p1_new", pricingPlanId: "p1", planName: "Free", price: "0.00", currency: "USD", billingPeriod: "monthly", features: ["F1"], usageLimits: {} },
    ];

    // matchPlans should detect that 3 plans are missing from the current partial pass
    const { matched, removed, added } = matchPlans(previousCompletePlans, currentPartialPlans);
    expect(matched).toHaveLength(1);
    expect(removed).toHaveLength(3);
    expect(added).toHaveLength(0);
    expect(removed.map((r) => r.planName)).toEqual(["Pro", "Pro+", "Max"]);
  });

  // Requirement 9.11: Repeated extraction without duplicate records
  it("11. matching logic ensures repeated extraction maps to the same identity key without duplication", () => {
    const snap1: SnapshotPlan = { id: "s1", pricingPlanId: "plan-uuid-1", planName: "Pro", price: "20.00", currency: "USD", billingPeriod: "monthly", features: [], usageLimits: {} };
    const snap2: SnapshotPlan = { id: "s2", pricingPlanId: "plan-uuid-1", planName: "pro", price: "20.00", currency: "USD", billingPeriod: "monthly", features: [], usageLimits: {} };

    const { matched, added } = matchPlans([snap1], [snap2]);
    expect(matched).toHaveLength(1);
    expect(added).toHaveLength(0);
  });
});
