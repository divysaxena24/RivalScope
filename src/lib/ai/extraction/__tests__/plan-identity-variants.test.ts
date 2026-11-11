import { describe, it, expect } from "vitest";
import { normalizePricingPlan, normalizeExtractionResult } from "../normalize-pricing";
import { mergeExtractionPasses } from "../merge-extractions";
import { matchPlans } from "../../../changes/match-plans";
import { ExtractedPricingPlan, NormalizedExtractionResult } from "../types";
import { SnapshotPlan } from "../../../changes/types";

describe("Universal Plan Identity & Pricing Variant Remediation Tests", () => {
  // Test 1: Monthly and annual variants of one plan
  it("preserves monthly and annual variants of the same plan as distinct offerings without merging", () => {
    const rawMonthly: ExtractedPricingPlan = {
      planName: "Pro",
      price: 20,
      currency: "USD",
      billingPeriod: "monthly",
      isFree: false,
      isCustomPricing: false,
      isPubliclyAvailable: true,
      originalPriceText: "$20/month",
      features: [],
      evidenceText: "Pro monthly",
    };

    const rawAnnual: ExtractedPricingPlan = {
      planName: "Pro",
      price: 17,
      currency: "USD",
      billingPeriod: "yearly",
      isFree: false,
      isCustomPricing: false,
      isPubliclyAvailable: true,
      originalPriceText: "$200 upfront ($17/month equivalent)",
      features: [],
      evidenceText: "Pro yearly",
    };

    const norm1 = normalizePricingPlan(rawMonthly, "USD");
    const norm2 = normalizePricingPlan(rawAnnual, "USD");

    const chunk1: NormalizedExtractionResult = {
      companyName: "Acme",
      productName: null,
      currency: "USD",
      region: null,
      status: "SUCCESS",
      rawPlanCount: 1,
      featureCount: 0,
      plans: [norm1],
    };

    const chunk2: NormalizedExtractionResult = {
      companyName: "Acme",
      productName: null,
      currency: "USD",
      region: null,
      status: "SUCCESS",
      rawPlanCount: 1,
      featureCount: 0,
      plans: [norm2],
    };

    const merged = mergeExtractionPasses([chunk1, chunk2]);
    expect(merged.plans).toHaveLength(2);
    expect(merged.plans.map((p) => `${p.planName} (${p.billingPeriod}: $${p.price})`)).toEqual([
      "Pro (monthly: $20.00)",
      "Pro (yearly: $17.00)",
    ]);
  });

  // Test 2: Identical plan names across different competitors
  it("keeps plans with identical names across competitors independent", () => {
    const comp1Plan: SnapshotPlan = {
      id: "s1",
      pricingPlanId: "comp1-plan-1",
      planName: "Enterprise",
      price: null,
      currency: "USD",
      billingPeriod: "custom",
      features: [],
      usageLimits: {},
    };

    const comp2Plan: SnapshotPlan = {
      id: "s2",
      pricingPlanId: "comp2-plan-1",
      planName: "Enterprise",
      price: null,
      currency: "USD",
      billingPeriod: "custom",
      features: [],
      usageLimits: {},
    };

    // When matched against comp1 only, comp2 plan is recognized as added/not matching
    const { matched, added } = matchPlans([comp1Plan], [comp2Plan]);
    expect(matched).toHaveLength(0); // Different pricingPlanId
    expect(added).toHaveLength(1);
  });

  // Test 3: Different plans with identical prices
  it("does not merge different plans merely because their prices match", () => {
    const rawPro: ExtractedPricingPlan = {
      planName: "Pro Tier",
      price: 20,
      currency: "USD",
      billingPeriod: "monthly",
      isFree: false,
      isCustomPricing: false,
      isPubliclyAvailable: true,
      originalPriceText: "$20/mo",
      features: [],
      evidenceText: "Pro",
    };

    const rawDev: ExtractedPricingPlan = {
      planName: "Developer Tier",
      price: 20,
      currency: "USD",
      billingPeriod: "monthly",
      isFree: false,
      isCustomPricing: false,
      isPubliclyAvailable: true,
      originalPriceText: "$20/mo",
      features: [],
      evidenceText: "Developer",
    };

    const res = normalizeExtractionResult({
      hasPricing: true,
      status: "SUCCESS",
      confidenceScore: 1,
      plans: [rawPro, rawDev],
    });

    expect(res.plans).toHaveLength(2);
    expect(res.plans[0].planName).toBe("Pro Tier");
    expect(res.plans[1].planName).toBe("Developer Tier");
    expect(res.plans[0].price).toBe("20.00");
    expect(res.plans[1].price).toBe("20.00");
  });

  // Test 4: Promotional versus standard pricing & numerical price retention
  it("retains explicit numerical prices even for tiers named Max or Enterprise", () => {
    const rawMax: ExtractedPricingPlan = {
      planName: "Max",
      price: 100,
      currency: "USD",
      billingPeriod: "monthly",
      isFree: false,
      isCustomPricing: false,
      isPubliclyAvailable: true,
      originalPriceText: "$100USD per user / month",
      features: [],
      evidenceText: "Max $100",
    };

    const norm = normalizePricingPlan(rawMax, "USD");
    expect(norm.isCustomPricing).toBe(false);
    expect(norm.price).toBe("100.00");
  });

  // Test 5: Contact Sales remains distinct from unknown pricing
  it("keeps Contact Sales distinct from unknown price and never converts to 0", () => {
    const rawContactSales: ExtractedPricingPlan = {
      planName: "Enterprise",
      price: null,
      currency: "USD",
      billingPeriod: "custom",
      isFree: false,
      isCustomPricing: true,
      isPubliclyAvailable: true,
      originalPriceText: "Contact Sales",
      features: [],
      evidenceText: "Call us",
    };

    const norm = normalizePricingPlan(rawContactSales, "USD");
    expect(norm.isCustomPricing).toBe(true);
    expect(norm.isFree).toBe(false);
    expect(norm.price).toBeNull();
  });

  // Test 6: Regional currency preservation without USD fallback
  it("preserves explicit EUR, GBP, INR without defaulting to USD", () => {
    const rawEUR: ExtractedPricingPlan = {
      planName: "EU Starter",
      price: 15,
      currency: "EUR",
      billingPeriod: "monthly",
      isFree: false,
      isCustomPricing: false,
      isPubliclyAvailable: true,
      originalPriceText: "€15/month",
      features: [],
      evidenceText: "Europe",
    };

    const norm = normalizePricingPlan(rawEUR, null, "EU");
    expect(norm.currency).toBe("EUR");
    expect(norm.region).toBe("EU");
    expect(norm.price).toBe("15.00");
  });
});
