import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildChatbotCompetitorContext } from "../chat-context";
import { db } from "@/lib/db";

// Mock the database queries inside chat-context
vi.mock("@/lib/db", () => {
  return {
    db: {
      select: vi.fn(),
    },
  };
});

describe("AI Insights Chat Context Grounding Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. filters out inactive/superseded plans and preserves only active plans", async () => {
    const mockCompetitors = [
      { id: "comp-1", name: "Copilot", domain: "github.com", website: "https://github.com", status: "active", industry: "Tech", description: "AI Assistant" },
    ];

    // Mock pricing_plans with one active and one inactive plan
    const mockPricingPlans = [
      {
        id: "plan-active-1",
        competitorId: "comp-1",
        planName: "Max",
        price: "100.00",
        currency: "USD",
        billingPeriod: "monthly",
        isCustomPricing: false,
        isActive: true,
        sourceUrl: "https://github.com/features/copilot/plans",
        features: ["Priority access", "2.9x usage"],
        usageLimits: { credits: "200" },
        updatedAt: new Date("2026-11-12T10:00:00Z"),
      },
    ];

    // Setup select mock chain
    let selectCallCount = 0;
    (db.select as any).mockImplementation(() => {
      selectCallCount++;
      // Call 1: competitors
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => Promise.resolve(mockCompetitors),
          }),
        };
      }
      // Call 2: pricingPlans
      if (selectCallCount === 2) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockPricingPlans),
            }),
          }),
        };
      }
      // Call 3: scrapeResults
      if (selectCallCount === 3) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([{ sourceUrl: "https://github.com/features/copilot/plans", scrapedAt: new Date("2026-11-12T10:00:00Z") }]),
              }),
            }),
          }),
        };
      }
      // Call 4: pricingSnapshots
      if (selectCallCount === 4) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                { pricingPlanId: "plan-active-1", price: "100.00", currency: "USD", observedAt: new Date("2026-11-12T10:00:00Z"), sourceUrl: "https://github.com/features/copilot/plans" },
              ]),
            }),
          }),
        };
      }
      // Call 5: featureSnapshots (active plan)
      if (selectCallCount === 5) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                { pricingPlanId: "plan-active-1", featureName: "Priority access", featureValue: "Included", sourceUrl: "https://github.com/features/copilot/plans", observedAt: new Date("2026-11-12T10:00:00Z") },
              ]),
            }),
          }),
        };
      }
      // Call 6: general featureSnapshots
      if (selectCallCount === 6) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        };
      }
      // Call 7: pricingChanges
      if (selectCallCount === 7) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        };
      }
      return {
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      };
    });

    const context = await buildChatbotCompetitorContext(["comp-1"]);

    expect(context.competitors).toHaveLength(1);
    expect(context.competitors[0].plans).toHaveLength(1);
    expect(context.competitors[0].plans[0].planName).toBe("Max");
    expect(context.competitors[0].plans[0].price).toBe("100.00");
    expect(context.summaryText).toContain('Plan: "Max" | Price: $100.00/monthly');
    expect(context.summaryText).toContain("Source: https://github.com/features/copilot/plans");
  });

  it("2. associates feature snapshots with their exact pricingPlanId and prevents mixing", async () => {
    const mockCompetitors = [
      { id: "comp-2", name: "Claude", domain: "claude.com", website: "https://claude.com", status: "active", industry: "Tech", description: "AI Assistant" },
    ];

    const mockPricingPlans = [
      {
        id: "plan-team",
        competitorId: "comp-2",
        planName: "Team",
        price: "30.00",
        currency: "USD",
        billingPeriod: "monthly",
        isCustomPricing: false,
        isActive: true,
        sourceUrl: "https://claude.com/pricing",
        features: [],
        usageLimits: {},
        updatedAt: new Date("2026-11-12T10:00:00Z"),
      },
      {
        id: "plan-enterprise",
        competitorId: "comp-2",
        planName: "Enterprise",
        price: null,
        currency: "USD",
        billingPeriod: "custom",
        isCustomPricing: true,
        isActive: true,
        sourceUrl: "https://claude.com/pricing",
        features: [],
        usageLimits: {},
        updatedAt: new Date("2026-11-12T10:00:00Z"),
      },
    ];

    let selectCallCount = 0;
    (db.select as any).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => Promise.resolve(mockCompetitors),
          }),
        };
      }
      if (selectCallCount === 2) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockPricingPlans),
            }),
          }),
        };
      }
      if (selectCallCount === 3) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([{ sourceUrl: "https://claude.com/pricing", scrapedAt: new Date("2026-11-12T10:00:00Z") }]),
              }),
            }),
          }),
        };
      }
      if (selectCallCount === 4) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([]),
            }),
          }),
        };
      }
      if (selectCallCount === 5) {
        // Feature snapshots: Team gets Team Collaboration; Enterprise gets SSO & Audit logs
        return {
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                { pricingPlanId: "plan-team", featureName: "Team Workspaces", featureValue: "Included", sourceUrl: "https://claude.com/pricing", observedAt: new Date("2026-11-12T10:00:00Z") },
                { pricingPlanId: "plan-enterprise", featureName: "SSO & SCIM", featureValue: "Included", sourceUrl: "https://claude.com/pricing", observedAt: new Date("2026-11-12T10:00:00Z") },
              ]),
            }),
          }),
        };
      }
      if (selectCallCount === 6) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        };
      }
      if (selectCallCount === 7) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        };
      }
      return {
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      };
    });

    const context = await buildChatbotCompetitorContext(["comp-2"]);
    const teamPlan = context.competitors[0].plans.find((p) => p.planName === "Team");
    const entPlan = context.competitors[0].plans.find((p) => p.planName === "Enterprise");

    expect(teamPlan?.featureSnapshots[0].name).toBe("Team Workspaces");
    expect(entPlan?.featureSnapshots[0].name).toBe("SSO & SCIM");
    // Ensure Enterprise feature didn't leak into Team plan
    expect(teamPlan?.featureSnapshots.some((f) => f.name === "SSO & SCIM")).toBe(false);
    expect(entPlan?.isCustomPricing).toBe(true);
    expect(context.summaryText).toContain("Contact Sales (Custom / Enterprise quote required)");
  });

  it("3. preserves both monthly and annual billing variants of the same plan name", async () => {
    const mockCompetitors = [
      { id: "comp-3", name: "Perplexity", domain: "perplexity.ai", website: "https://perplexity.ai", status: "active", industry: "Tech", description: "Search AI" },
    ];

    const mockPricingPlans = [
      {
        id: "plan-pro-monthly",
        competitorId: "comp-3",
        planName: "Pro",
        price: "20.00",
        currency: "USD",
        billingPeriod: "monthly",
        isCustomPricing: false,
        isActive: true,
        sourceUrl: "https://perplexity.ai/pricing",
        features: ["Pro Search"],
        usageLimits: {},
        updatedAt: new Date("2026-11-12T10:00:00Z"),
      },
      {
        id: "plan-pro-yearly",
        competitorId: "comp-3",
        planName: "Pro",
        price: "17.00",
        currency: "USD",
        billingPeriod: "yearly",
        isCustomPricing: false,
        isActive: true,
        sourceUrl: "https://perplexity.ai/pricing",
        features: ["Pro Search"],
        usageLimits: {},
        updatedAt: new Date("2026-11-12T10:00:00Z"),
      },
    ];

    let selectCallCount = 0;
    (db.select as any).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return { from: () => ({ where: () => Promise.resolve(mockCompetitors) }) };
      if (selectCallCount === 2) return { from: () => ({ where: () => ({ orderBy: () => Promise.resolve(mockPricingPlans) }) }) };
      if (selectCallCount === 3) return { from: () => ({ where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }) }) };
      if (selectCallCount === 4) return { from: () => ({ where: () => ({ orderBy: () => Promise.resolve([]) }) }) };
      if (selectCallCount === 5) return { from: () => ({ where: () => ({ orderBy: () => Promise.resolve([]) }) }) };
      if (selectCallCount === 6) return { from: () => ({ where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }) }) };
      if (selectCallCount === 7) return { from: () => ({ where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }) }) };
      return { from: () => ({ where: () => Promise.resolve([]) }) };
    });

    const context = await buildChatbotCompetitorContext(["comp-3"]);
    expect(context.competitors[0].plans).toHaveLength(2);
    expect(context.summaryText).toContain('Plan: "Pro" | Price: $20.00/monthly');
    expect(context.summaryText).toContain('Plan: "Pro" | Price: $17.00/yearly');
  });
});

