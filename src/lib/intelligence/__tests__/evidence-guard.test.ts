import { describe, it, expect, vi } from "vitest";
import {
  identifyDeterministicQuery,
  executeDeterministicQuery,
} from "../deterministic-queries";
import { verifyAndSanitizeResponse } from "../evidence-guard";
import { GroundedCompetitorData } from "../chat-context";

describe("Evidence-Constrained Response Layer & Deterministic Retrieval Tests", () => {
  const mockGroundedData: GroundedCompetitorData[] = [
    {
      id: "comp-copilot",
      name: "GitHub Copilot",
      domain: "github.com",
      website: "https://github.com",
      industry: "Developer Tools",
      description: "AI code completion and assistant",
      latestScrapeUrl: "https://github.com/features/copilot/plans",
      latestScrapeTimestamp: new Date("2026-11-15T12:00:00Z"),
      plans: [
        {
          id: "plan-free",
          planName: "Free",
          price: "0.00",
          currency: "USD",
          billingPeriod: "monthly",
          isCustomPricing: false,
          sourceUrl: "https://github.com/features/copilot/plans",
          lastObservedAt: new Date("2026-11-15T12:00:00Z"),
          features: ["2,000 completions/month", "50 chat messages"],
          featureSnapshots: [],
          usageLimits: { completions: "2000/mo" },
          tierCategory: "Consumer / Prosumer",
        },
        {
          id: "plan-pro",
          planName: "Pro",
          price: "10.00",
          currency: "USD",
          billingPeriod: "monthly",
          isCustomPricing: false,
          sourceUrl: "https://github.com/features/copilot/plans",
          lastObservedAt: new Date("2026-11-15T12:00:00Z"),
          features: ["Unlimited completions"],
          featureSnapshots: [{ name: "Completions", value: "Unlimited", sourceUrl: null, observedAt: null }],
          usageLimits: {},
          tierCategory: "Consumer / Prosumer",
        },
        {
          id: "plan-max",
          planName: "Max",
          price: null,
          currency: "USD",
          billingPeriod: "monthly",
          isCustomPricing: true,
          pricingConflictNote: "DATA CONFLICT DETECTED: Stored database record indicates Custom Pricing/Contact Sales, whereas GitHub source scrape documents $100.00 USD/month ($100/month per user for high-volume workflows).",
          sourceUrl: "https://github.com/features/copilot/plans",
          lastObservedAt: new Date("2026-11-15T12:00:00Z"),
          features: ["Priority access"],
          featureSnapshots: [],
          usageLimits: {},
          tierCategory: "Consumer / Prosumer",
        },
      ],
      unassociatedFeatures: [],
      recentChanges: [],
    },
    {
      id: "comp-perplexity",
      name: "Perplexity",
      domain: "perplexity.ai",
      website: "https://perplexity.ai",
      industry: "Search AI",
      description: "AI search engine",
      latestScrapeUrl: "https://perplexity.ai/pricing",
      latestScrapeTimestamp: new Date("2026-11-15T12:00:00Z"),
      plans: [
        {
          id: "plan-perp-free",
          planName: "Free",
          price: "0.00",
          currency: "USD",
          billingPeriod: "monthly",
          isCustomPricing: false,
          sourceUrl: "https://perplexity.ai/pricing",
          lastObservedAt: new Date("2026-11-15T12:00:00Z"),
          features: ["Quick search"],
          featureSnapshots: [],
          usageLimits: {},
          tierCategory: "Consumer / Prosumer",
        },
        {
          id: "plan-perp-pro-yearly",
          planName: "Pro",
          price: "17.00",
          currency: "USD",
          billingPeriod: "yearly",
          annualEquivalentMonthly: "$17.00/month (charged annually as $204.00/year)",
          isCustomPricing: false,
          sourceUrl: "https://perplexity.ai/pricing",
          lastObservedAt: new Date("2026-11-15T12:00:00Z"),
          features: ["Pro search"],
          featureSnapshots: [],
          usageLimits: {},
          tierCategory: "Consumer / Prosumer",
        },
      ],
      unassociatedFeatures: [],
      recentChanges: [],
    },
    {
      id: "comp-claude",
      name: "Claude",
      domain: "claude.com",
      website: "https://claude.com",
      industry: "AI Assistant",
      description: "Anthropic Claude",
      latestScrapeUrl: "https://claude.com/pricing",
      latestScrapeTimestamp: new Date("2026-11-15T12:00:00Z"),
      plans: [
        {
          id: "plan-claude-enterprise",
          planName: "Enterprise",
          price: null,
          currency: "USD",
          billingPeriod: "custom",
          isCustomPricing: true,
          sourceUrl: "https://claude.com/pricing",
          lastObservedAt: new Date("2026-11-15T12:00:00Z"),
          features: ["SSO", "SCIM"],
          featureSnapshots: [],
          usageLimits: {},
          tierCategory: "Enterprise",
        },
      ],
      unassociatedFeatures: [],
      recentChanges: [],
    },
  ];

  describe("1. Deterministic Question Identification & Direct DB Retrieval", () => {
    it("identifies free plan inquiries across all competitors and produces exact DB facts", () => {
      const check = identifyDeterministicQuery("Which competitors offer a free plan?", ["GitHub Copilot", "Perplexity", "Claude"]);
      expect(check.isDeterministic).toBe(true);
      expect(check.type).toBe("FREE_PLANS");

      const result = executeDeterministicQuery(check.type!, mockGroundedData);
      expect(result.markdownReply).toContain("### 1. Verified Database Facts");
      expect(result.markdownReply).toContain("### 2. Derived Observations");
      expect(result.markdownReply).toContain("### 3. Strategic Recommendations");
      expect(result.markdownReply).toContain("GitHub Copilot");
      expect(result.markdownReply).toContain("Perplexity");
      expect(result.markdownReply).toContain("$0.00 (Free)");
    });

    it("identifies competitor pricing tiers query and returns structured plans", () => {
      const check = identifyDeterministicQuery("What are Copilot's pricing tiers?", ["GitHub Copilot", "Perplexity", "Claude"]);
      expect(check.isDeterministic).toBe(true);
      expect(check.type).toBe("COMPETITOR_TIERS");

      const result = executeDeterministicQuery(check.type!, mockGroundedData, "GitHub Copilot");
      expect(result.markdownReply).toContain("GitHub Copilot");
      expect(result.markdownReply).toContain("| GitHub Copilot | Free |");
      expect(result.markdownReply).toContain("| GitHub Copilot | Pro |");
      expect(result.markdownReply).toContain("| GitHub Copilot | Max |");
      // Must contain warning for Copilot Max conflict
      expect(result.markdownReply).toContain("DATA CONFLICT DETECTED");
    });

    it("identifies annual billing queries and preserves monthly-equivalent vs yearly charge", () => {
      const check = identifyDeterministicQuery("Which competitors offer annual billing?", ["GitHub Copilot", "Perplexity", "Claude"]);
      expect(check.isDeterministic).toBe(true);
      expect(check.type).toBe("ANNUAL_BILLING");

      const result = executeDeterministicQuery(check.type!, mockGroundedData);
      expect(result.markdownReply).toContain("Perplexity");
      expect(result.markdownReply).toContain("$17.00/yearly ($17.00/month (charged annually as $204.00/year))");
    });

    it("identifies custom pricing queries and lists enterprise quote tiers", () => {
      const check = identifyDeterministicQuery("Which plans have custom pricing?", ["GitHub Copilot", "Perplexity", "Claude"]);
      expect(check.isDeterministic).toBe(true);
      expect(check.type).toBe("CUSTOM_PRICING");

      const result = executeDeterministicQuery(check.type!, mockGroundedData);
      expect(result.markdownReply).toContain("Claude");
      expect(result.markdownReply).toContain("Contact Sales (Custom quote required)");
    });
  });

  describe("2. Evidence Guard: Hallucination & Unsupported Claim Sanitization", () => {
    it("detects and flags unsupported frontier model names not in DB records", () => {
      const sampleLLMReply = `
### 1. Executive Summary
ChatGPT Plus includes GPT-4o and Claude 3.5 Sonnet for reasoning.

### 2. Pricing & Packaging Matrix
| Competitor | Plan Name | Price | Billing Period | Key Entitlements |
| :--- | :--- | :--- | :--- | :--- |
| GitHub Copilot | Pro | $10.00 | monthly | Fast completions |

### 4. Strategic Observations
Consider testing alternative models.
`;

      const guarded = verifyAndSanitizeResponse(sampleLLMReply, mockGroundedData);
      expect(guarded.isValid).toBe(false);
      expect(guarded.violations.some((v) => v.includes("GPT-4o"))).toBe(true);
      expect(guarded.violations.some((v) => v.includes("Claude 3.5 Sonnet"))).toBe(true);
      expect(guarded.sanitizedText).toContain("GPT-4o [Not specified in database records]");
      expect(guarded.sanitizedText).toContain("Claude 3.5 Sonnet [Not specified in database records]");
    });

    it("detects and flags unsupported unlimited claims when quota is absent in records", () => {
      const sampleLLMReply = `
### 1. Executive Summary
Claude Enterprise provides unlimited tokens for teams.

### 4. Strategic Observations
Competitive advantage.
`;

      const guarded = verifyAndSanitizeResponse(sampleLLMReply, mockGroundedData);
      expect(guarded.isValid).toBe(false);
      expect(guarded.violations.some((v) => v.includes("unlimited"))).toBe(true);
      expect(guarded.sanitizedText).toContain("unlimited tokens [Quota not specified in database records]");
    });

    it("passes cleanly when all claims are grounded in database evidence", () => {
      const sampleLLMReply = `
### 1. Verified Database Facts
GitHub Copilot Pro offers code completion for $10.00/month.

### 3. Strategic Recommendations
[Assumption] Evaluate pricing models against server hosting costs.
`;

      const guarded = verifyAndSanitizeResponse(sampleLLMReply, mockGroundedData);
      expect(guarded.violations).toHaveLength(0);
      expect(guarded.isValid).toBe(true);
      expect(guarded.sanitizedText).toBe(sampleLLMReply);
    });
  });

  describe("3. Contradiction & Conflict Handling", () => {
    it("reports conflict when active pricing record has conflicting source data (Copilot Max)", () => {
      const check = identifyDeterministicQuery("What are Copilot's pricing tiers?", ["GitHub Copilot"]);
      const res = executeDeterministicQuery(check.type!, mockGroundedData, "GitHub Copilot");

      expect(res.markdownReply).toContain("DATA CONFLICT DETECTED");
      expect(res.markdownReply).toContain("$100.00 USD/month");
    });
  });
});
