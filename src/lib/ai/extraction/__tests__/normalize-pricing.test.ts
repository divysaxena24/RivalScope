import { describe, it, expect } from "vitest";
import {
  normalizeCurrency,
  normalizePricingPlan,
  normalizeExtractionResult,
} from "../normalize-pricing";
import {
  normalizeFeatureAvailability,
  ExtractedFeatureSchema,
  ExtractedPricingPlan,
} from "../types";

describe("Pricing & Feature Extraction Accuracy Tests", () => {
  describe("1. Currency & Pricing Integrity (Untouched & Preserved)", () => {
    it("maps currency symbols safely without changing amounts", () => {
      expect(normalizeCurrency("$")).toBe("USD");
      expect(normalizeCurrency("€")).toBe("EUR");
      expect(normalizeCurrency("£")).toBe("GBP");
      expect(normalizeCurrency("₹")).toBe("INR");
      expect(normalizeCurrency("USD")).toBe("USD");
      expect(normalizeCurrency("INR")).toBe("INR");
      expect(normalizeCurrency(null)).toBe(null);
    });

    it("handles free plans with price 0.00", () => {
      const raw: ExtractedPricingPlan = {
        planName: "Community Free",
        price: 0,
        currency: "USD",
        billingPeriod: "monthly",
        isCustomPricing: false,
        isFree: true,
        isPubliclyAvailable: true,
        originalPriceText: "$0 forever",
        features: [],
        evidenceText: "Free forever plan",
      };

      const normalized = normalizePricingPlan(raw, "USD");
      expect(normalized.price).toBe("0.00");
      expect(normalized.isFree).toBe(true);
      expect(normalized.isCustomPricing).toBe(false);
    });

    it("preserves annual pricing without dividing by 12", () => {
      const raw: ExtractedPricingPlan = {
        planName: "Annual Pro",
        price: 190,
        currency: "USD",
        billingPeriod: "yearly",
        isCustomPricing: false,
        isFree: false,
        isPubliclyAvailable: true,
        originalPriceText: "$190 billed annually",
        features: [],
        evidenceText: "Billed at $190/year",
      };

      const normalized = normalizePricingPlan(raw, "USD");
      expect(normalized.price).toBe("190.00");
      expect(normalized.billingPeriod).toBe("yearly");
    });
  });

  describe("2. Feature Availability State Normalization", () => {
    it("normalizes Yes / Included / Checked to 'included'", () => {
      expect(normalizeFeatureAvailability("Yes")).toBe("included");
      expect(normalizeFeatureAvailability("yes")).toBe("included");
      expect(normalizeFeatureAvailability("Included")).toBe("included");
      expect(normalizeFeatureAvailability("Standard")).toBe("included");
      expect(normalizeFeatureAvailability("Checked")).toBe("included");
      expect(normalizeFeatureAvailability("Unlimited")).toBe("included");
    });

    it("normalizes No / Not available / Excluded to 'not_included'", () => {
      expect(normalizeFeatureAvailability("No")).toBe("not_included");
      expect(normalizeFeatureAvailability("no")).toBe("not_included");
      expect(normalizeFeatureAvailability("Not available")).toBe("not_included");
      expect(normalizeFeatureAvailability("Excluded")).toBe("not_included");
      expect(normalizeFeatureAvailability("Requires add-on")).toBe("not_included");
    });

    it("normalizes Limited, quotas, and numeric limits to 'limited'", () => {
      expect(normalizeFeatureAvailability("Limited")).toBe("limited");
      expect(normalizeFeatureAvailability("27K")).toBe("limited");
      expect(normalizeFeatureAvailability("10x")).toBe("limited");
      expect(normalizeFeatureAvailability("Limited (desktop app)")).toBe("limited");
      expect(normalizeFeatureAvailability("Up to 5 dashboards")).toBe("limited");
      expect(normalizeFeatureAvailability("More usage")).toBe("limited");
      expect(normalizeFeatureAvailability("Expanded")).toBe("limited");
      expect(normalizeFeatureAvailability("Maximum usage")).toBe("limited");
    });

    it("normalizes null, undefined, —, or empty values to 'unknown'", () => {
      expect(normalizeFeatureAvailability(null)).toBe("unknown");
      expect(normalizeFeatureAvailability(undefined)).toBe("unknown");
      expect(normalizeFeatureAvailability("")).toBe("unknown");
      expect(normalizeFeatureAvailability("—")).toBe("unknown");
      expect(normalizeFeatureAvailability("Unknown")).toBe("unknown");
      expect(normalizeFeatureAvailability("Not specified")).toBe("unknown");
    });
  });

  describe("3. Feature Schema & Rich Attributes Extraction", () => {
    it("preserves numeric limit and unit from '27K' and '10x'", () => {
      const parsed27k = ExtractedFeatureSchema.parse({
        name: "GPT Instant total context window",
        value: "27K",
      });
      expect(parsed27k.availability).toBe("limited");
      expect(parsed27k.originalValue).toBe("27K");
      expect(parsed27k.numericLimit).toBe(27);
      expect(parsed27k.limitUnit).toBe("K");

      const parsed10x = ExtractedFeatureSchema.parse({
        name: "Speed Boost",
        value: "10x",
      });
      expect(parsed10x.availability).toBe("limited");
      expect(parsed10x.originalValue).toBe("10x");
      expect(parsed10x.numericLimit).toBe(10);
      expect(parsed10x.limitUnit).toBe("x");
    });

    it("preserves descriptive limitations e.g. 'Limited (desktop app)'", () => {
      const parsed = ExtractedFeatureSchema.parse({
        name: "ChatGPT Work",
        value: "Limited (desktop app)",
        evidenceText: "Plan: Free, Feature: ChatGPT Work, Limited (desktop app)",
      });

      expect(parsed.availability).toBe("limited");
      expect(parsed.originalValue).toBe("Limited (desktop app)");
      expect(parsed.limitationDescription).toBe("Limited (desktop app)");
      expect(parsed.evidenceText).toContain("Limited (desktop app)");
    });
  });

  describe("4. Plan-Specific Feature Isolation Across Tiers", () => {
    it("distinguishes tiered capability differences across Free, Go, Plus, and Pro", () => {
      const rawPlans: ExtractedPricingPlan[] = [
        {
          planName: "Free",
          price: 0,
          currency: "USD",
          billingPeriod: "monthly",
          isCustomPricing: false,
          isFree: true,
          isPubliclyAvailable: true,
          originalPriceText: "$0",
          features: [
            ExtractedFeatureSchema.parse({ name: "GPT-6.1 Sol", value: "No" }),
            ExtractedFeatureSchema.parse({ name: "ChatGPT Work", value: "Limited (desktop app)" }),
            ExtractedFeatureSchema.parse({ name: "Context Window", value: "27K" }),
          ],
          evidenceText: "Free plan",
        },
        {
          planName: "Go",
          price: 8,
          currency: "USD",
          billingPeriod: "monthly",
          isCustomPricing: false,
          isFree: false,
          isPubliclyAvailable: true,
          originalPriceText: "$8",
          features: [
            ExtractedFeatureSchema.parse({ name: "GPT-6.1 Sol", value: "No" }),
            ExtractedFeatureSchema.parse({ name: "ChatGPT Work", value: "Limited (desktop app)" }),
            ExtractedFeatureSchema.parse({ name: "Context Window", value: "54K" }),
          ],
          evidenceText: "Go plan",
        },
        {
          planName: "Plus",
          price: 20,
          currency: "USD",
          billingPeriod: "monthly",
          isCustomPricing: false,
          isFree: false,
          isPubliclyAvailable: true,
          originalPriceText: "$20",
          features: [
            ExtractedFeatureSchema.parse({ name: "GPT-6.1 Sol", value: "Yes" }),
            ExtractedFeatureSchema.parse({ name: "ChatGPT Work", value: "Expanded" }),
            ExtractedFeatureSchema.parse({ name: "Context Window", value: "128K" }),
          ],
          evidenceText: "Plus plan",
        },
        {
          planName: "Pro",
          price: 100,
          currency: "USD",
          billingPeriod: "monthly",
          isCustomPricing: false,
          isFree: false,
          isPubliclyAvailable: true,
          originalPriceText: "$100",
          features: [
            ExtractedFeatureSchema.parse({ name: "GPT-6.1 Sol", value: "Expanded" }),
            ExtractedFeatureSchema.parse({ name: "ChatGPT Work", value: "Unlimited" }),
            ExtractedFeatureSchema.parse({ name: "Context Window", value: "200K" }),
          ],
          evidenceText: "Pro plan",
        },
      ];

      const normFree = normalizePricingPlan(rawPlans[0], "USD");
      const normGo = normalizePricingPlan(rawPlans[1], "USD");
      const normPlus = normalizePricingPlan(rawPlans[2], "USD");
      const normPro = normalizePricingPlan(rawPlans[3], "USD");

      // Verify GPT-6.1 Sol availability per plan:
      expect(normFree.features.find((f) => f.name === "GPT-6.1 Sol")?.availability).toBe("not_included");
      expect(normGo.features.find((f) => f.name === "GPT-6.1 Sol")?.availability).toBe("not_included");
      expect(normPlus.features.find((f) => f.name === "GPT-6.1 Sol")?.availability).toBe("included");
      expect(normPro.features.find((f) => f.name === "GPT-6.1 Sol")?.availability).toBe("limited");
      expect(normPro.features.find((f) => f.name === "GPT-6.1 Sol")?.originalValue).toBe("Expanded");

      // Verify Context Window per plan:
      expect(normFree.features.find((f) => f.name === "Context Window")?.originalValue).toBe("27K");
      expect(normGo.features.find((f) => f.name === "Context Window")?.originalValue).toBe("54K");
      expect(normPlus.features.find((f) => f.name === "Context Window")?.originalValue).toBe("128K");
      expect(normPro.features.find((f) => f.name === "Context Window")?.originalValue).toBe("200K");
    });
  });
});
