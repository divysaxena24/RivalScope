import { describe, it, expect } from "vitest";
import { validateAndParseInsights } from "../validate-insights";
import { buildCompetitorInsightPrompt } from "../prompts/strategic-insights";
import { CompetitorIntelligenceContext } from "../types";

describe("Strategic Intelligence Validation & Parsing", () => {
  it("should validate and parse structured strategic insights", () => {
    const validJson = JSON.stringify({
      executiveSummary: "Competitor is aggressively raising prices on pro tiers.",
      marketPosture: "aggressive",
      insights: [
        {
          competitorName: "LinearStack",
          title: "Pro Tier Price Escalation",
          insightType: "pricing",
          impact: "high",
          marketPosture: "aggressive",
          summary: "LinearStack increased their Pro monthly plan from $20 to $25.",
          strategicImplications: [
            "Creates an opportunity to undercut them in the sub-$20 SMB market",
            "Signals confidence in enterprise adoption",
          ],
          actionPlaybook: {
            product: ["Maintain competitive feature parity on collaboration tools"],
            pricing: ["Position our $15 plan against their new $25 tier"],
            marketing: ["Launch comparison campaign targeting price sensitivity"],
            sales: ["Offer transition credits for prospects switching from LinearStack"],
          },
          evidenceList: [
            {
              claim: "Pro plan price increased by $5",
              sourceType: "pricing_change",
              observedValue: "$25.00",
              previousValue: "$20.00",
            },
          ],
          confidenceScore: 0.95,
        },
      ],
    });

    const parsed = validateAndParseInsights(validJson);
    expect(parsed.insights).toHaveLength(1);
    expect(parsed.insights[0].title).toBe("Pro Tier Price Escalation");
    expect(parsed.insights[0].impact).toBe("high");
    expect(parsed.insights[0].evidenceList).toHaveLength(1);
  });

  it("should strip markdown code blocks before parsing", () => {
    const wrappedJson = `\`\`\`json
{
  "executiveSummary": "Summary test",
  "insights": [
    {
      "title": "New Free Tier Limits",
      "insightType": "packaging",
      "impact": "medium",
      "summary": "Free tier user count capped at 5 seats.",
      "strategicImplications": ["Target multi-user teams"],
      "actionPlaybook": {
        "product": [],
        "pricing": [],
        "marketing": ["Highlight generous free limits"],
        "sales": []
      },
      "evidenceList": []
    }
  ]
}
\`\`\``;

    const parsed = validateAndParseInsights(wrappedJson);
    expect(parsed.insights).toHaveLength(1);
    expect(parsed.insights[0].insightType).toBe("packaging");
  });

  it("should assemble a non-empty context-grounded prompt for single competitor", () => {
    const mockContext: CompetitorIntelligenceContext = {
      competitorId: "comp-123",
      competitorName: "ChatGPT",
      domain: "chatgpt.com",
      industry: "AI / Technology",
      activePlans: [
        {
          id: "plan-1",
          planName: "ChatGPT Plus",
          price: "20.00",
          currency: "USD",
          billingPeriod: "monthly",
          features: ["Browsing", "Advanced Voice"],
          usageLimits: { messages: "80 every 3 hours" },
        },
      ],
      recentChanges: [
        {
          id: "chg-1",
          changeType: "price_increase",
          fieldName: "price",
          oldValue: "18.00",
          newValue: "20.00",
          percentageDifference: "11.11",
          description: "Price increased from $18 to $20",
          detectedAt: new Date(),
        },
      ],
      recentScrapes: [
        {
          id: "scr-1",
          sourceUrl: "https://chatgpt.com/pricing",
          scrapedAt: new Date(),
          pageTitle: "Pricing",
          contentSnippet: "ChatGPT Plus is $20/month",
        },
      ],
    };

    const prompt = buildCompetitorInsightPrompt(mockContext);
    expect(prompt).toContain("TARGET COMPETITOR: ChatGPT");
    expect(prompt).toContain("ChatGPT Plus");
    expect(prompt).toContain("price_increase");
  });
});
