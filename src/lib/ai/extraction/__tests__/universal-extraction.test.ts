import { describe, it, expect } from "vitest";
import { preprocessPricingMarkdown } from "../markdown-preprocessor";
import { getModelTokenBudget, estimateTokens } from "../token-budget";
import { chunkMarkdownForExtraction } from "../markdown-chunker";
import { mergeExtractionPasses } from "../merge-extractions";
import { NormalizedExtractionResult } from "../types";

describe("Universal Preprocessing & Token Budget Extraction Tests", () => {
  it("1. Universal Preprocessing cleans navigation noise while preserving pricing tables", () => {
    const rawMarkdown = `
[Skip to main content](https://example.com#main)
[Cookie Policy](https://example.com/cookies)
![](https://cdn.example.com/icons/logo.svg)

# Pricing Plans

| Plan | Price | Features |
| --- | --- | --- |
| Starter | $10/mo | 5 Users |
| Pro | $30/mo | Unlimited Users |

* [Select Region](https://example.com/locale)
* Free: $0/mo
    `;

    const cleaned = preprocessPricingMarkdown(rawMarkdown);
    expect(cleaned).toContain("# Pricing Plans");
    expect(cleaned).toContain("| Plan | Price | Features |");
    expect(cleaned).toContain("| Starter | $10/mo | 5 Users |");
    expect(cleaned).toContain("| Pro | $30/mo | Unlimited Users |");
    expect(cleaned).toContain("Free: $0/mo");
    expect(cleaned).not.toContain("Skip to main content");
    expect(cleaned).not.toContain("logo.svg");
    expect(cleaned).not.toContain("Cookie Policy");
  });

  it("2. Token Budget accurately calculates limits for configured models", () => {
    const qwenBudget = getModelTokenBudget("qwen/qwen3.8-27b");
    expect(qwenBudget.inputTokenPerMinuteLimit).toBe(7000);
    expect(qwenBudget.maxChunkInputTokens).toBeLessThanOrEqual(2200);

    const gptBudget = getModelTokenBudget("openai/gpt-oss-120b");
    expect(gptBudget.inputTokenPerMinuteLimit).toBe(8000);
    expect(gptBudget.maxChunkInputTokens).toBeLessThanOrEqual(2200);
  });

  it("3. Markdown chunker keeps pricing tables and headings intact", () => {
    const budget = getModelTokenBudget("qwen/qwen3.8-27b");
    const longDocument = `
# Section 1
${"Some text describing the product capabilities in detail with extensive paragraphs.\n".repeat(150)}

# Section 2
## Pricing Tiers
| Tier | Price |
| --- | --- |
| Standard | $20 |
| Enterprise | Custom |

${"Additional feature terms and legal notes spanning multiple long paragraphs.\n".repeat(120)}
    `;

    const chunks = chunkMarkdownForExtraction(longDocument, budget);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].totalChunks).toBe(chunks.length);

    // Verify table wasn't sliced in half without headers
    const tableChunk = chunks.find((c) => c.content.includes("| Standard | $20 |"));
    expect(tableChunk).toBeDefined();
    expect(tableChunk?.content).toContain("| Tier | Price |");
  });

  it("4. Merges extraction passes across chunks without losing distinct plans", () => {
    const pass1: NormalizedExtractionResult = {
      companyName: "Acme",
      productName: "Cloud",
      currency: "USD",
      region: null,
      status: "SUCCESS",
      rawPlanCount: 2,
      featureCount: 2,
      plans: [
        {
          planName: "Free",
          description: "Free plan",
          price: "0.00",
          currency: "USD",
          region: null,
          billingPeriod: "monthly",
          isCustomPricing: false,
          isActive: true,
          isFree: true,
          originalPriceText: "$0",
          discountInfo: null,
          features: [
            {
              name: "100 API Calls",
              description: null,
              availability: "limited",
              originalValue: "100",
              numericLimit: 100,
              limitUnit: "calls",
              limitationDescription: "100 API Calls",
              evidenceText: "100 API Calls",
            },
          ],
          usageLimits: {},
          targetSegment: null,
          evidenceText: "Free $0",
        },
      ],
    };

    const pass2: NormalizedExtractionResult = {
      companyName: "Acme",
      productName: "Cloud",
      currency: "USD",
      region: null,
      status: "SUCCESS",
      rawPlanCount: 1,
      featureCount: 1,
      plans: [
        {
          planName: "Enterprise",
          description: "Custom enterprise plan",
          price: null,
          currency: "USD",
          region: null,
          billingPeriod: "custom",
          isCustomPricing: true,
          isActive: true,
          isFree: false,
          originalPriceText: "Contact Sales",
          discountInfo: null,
          features: [
            {
              name: "Dedicated Account Manager",
              description: null,
              availability: "included",
              originalValue: "Yes",
              numericLimit: null,
              limitUnit: null,
              limitationDescription: null,
              evidenceText: "Dedicated Account Manager: Yes",
            },
          ],
          usageLimits: {},
          targetSegment: null,
          evidenceText: "Enterprise Contact Sales",
        },
      ],
    };

    const merged = mergeExtractionPasses([pass1, pass2]);
    expect(merged.status).toBe("SUCCESS");
    expect(merged.plans).toHaveLength(2);
    expect(merged.plans.map((p) => p.planName)).toEqual(["Free", "Enterprise"]);
    expect(merged.currency).toBe("USD");
  });

  it("5. Merges features for the same plan across different chunks", () => {
    const pass1: NormalizedExtractionResult = {
      companyName: "Acme",
      productName: "Cloud",
      currency: "USD",
      region: null,
      status: "SUCCESS",
      rawPlanCount: 1,
      featureCount: 1,
      plans: [
        {
          planName: "Pro",
          description: null,
          price: "20.00",
          currency: "USD",
          region: null,
          billingPeriod: "monthly",
          isCustomPricing: false,
          isActive: true,
          isFree: false,
          originalPriceText: "$20",
          discountInfo: null,
          features: [
            {
              name: "Voice Mode",
              description: null,
              availability: "included",
              originalValue: "Yes",
              numericLimit: null,
              limitUnit: null,
              limitationDescription: null,
              evidenceText: "Voice Mode",
            },
          ],
          usageLimits: {},
          targetSegment: null,
          evidenceText: "Pro $20",
        },
      ],
    };

    const pass2: NormalizedExtractionResult = {
      companyName: "Acme",
      productName: "Cloud",
      currency: "USD",
      region: null,
      status: "SUCCESS",
      rawPlanCount: 1,
      featureCount: 1,
      plans: [
        {
          planName: "Pro",
          description: "Detailed feature table entry",
          price: null,
          currency: "USD",
          region: null,
          billingPeriod: "unknown",
          isCustomPricing: false,
          isActive: true,
          isFree: false,
          originalPriceText: "$20",
          discountInfo: null,
          features: [
            {
              name: "File Uploads",
              description: null,
              availability: "limited",
              originalValue: "10GB",
              numericLimit: 10,
              limitUnit: "GB",
              limitationDescription: "10GB",
              evidenceText: "File Uploads: 10GB",
            },
          ],
          usageLimits: {},
          targetSegment: null,
          evidenceText: "Pro table row",
        },
      ],
    };

    const merged = mergeExtractionPasses([pass1, pass2]);
    expect(merged.plans).toHaveLength(1);
    const pro = merged.plans[0];
    expect(pro.planName).toBe("Pro");
    expect(pro.price).toBe("20.00"); // preserved from pass 1
    expect(pro.description).toBe("Detailed feature table entry"); // enriched from pass 2
    expect(pro.features).toHaveLength(2); // both Voice Mode and File Uploads preserved
  });
});
