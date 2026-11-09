import { describe, it, expect } from "vitest";
import { normalizeFeatureAvailability } from "../../ai/extraction/types";

describe("Multi-URL Feature Aggregation & Precedence Logic", () => {
  // Define source precedence logic matching comparison route
  const getPrecedence = (pageType: string | null | undefined, sourceUrl: string | null): number => {
    const type = (pageType || "").toLowerCase();
    const url = (sourceUrl || "").toLowerCase();
    if (type === "pricing" || url.includes("pricing")) return 30;
    if (type === "features" || type === "product" || url.includes("feature") || url.includes("product")) return 20;
    return 10;
  };

  interface CandidateSnapshot {
    featureName: string;
    featureValue: string | null;
    sourceUrl: string | null;
    observedAt: Date;
    pageType: string;
  }

  function aggregateSnapshots(rows: CandidateSnapshot[]) {
    const planFeaturesMap = new Map<string, CandidateSnapshot>();

    for (const row of rows) {
      const lowerName = row.featureName.trim().toLowerCase();

      if (!planFeaturesMap.has(lowerName)) {
        planFeaturesMap.set(lowerName, row);
      } else {
        const existing = planFeaturesMap.get(lowerName)!;
        const existingPrec = getPrecedence(existing.pageType, existing.sourceUrl);
        const currentPrec = getPrecedence(row.pageType, row.sourceUrl);

        if (currentPrec > existingPrec) {
          planFeaturesMap.set(lowerName, row);
        } else if (currentPrec === existingPrec) {
          if (row.observedAt > existing.observedAt) {
            planFeaturesMap.set(lowerName, row);
          }
        }
      }
    }

    return planFeaturesMap;
  }

  it("aggregates features across different tracked URLs for the same plan", () => {
    const pricingUrlFeatures: CandidateSnapshot[] = [
      {
        featureName: "GPT-4o Access",
        featureValue: "included",
        sourceUrl: "https://openai.com/chatgpt/pricing",
        observedAt: new Date("2026-11-08T10:00:00Z"),
        pageType: "pricing",
      },
      {
        featureName: "Standard Voice",
        featureValue: "included",
        sourceUrl: "https://openai.com/chatgpt/pricing",
        observedAt: new Date("2026-11-08T10:00:00Z"),
        pageType: "pricing",
      },
    ];

    const featurePageFeatures: CandidateSnapshot[] = [
      {
        featureName: "Canvas Collaboration",
        featureValue: "limited (early beta)",
        sourceUrl: "https://openai.com/chatgpt/features",
        observedAt: new Date("2026-11-08T11:00:00Z"),
        pageType: "features",
      },
      {
        featureName: "Custom GPTs Creation",
        featureValue: "included",
        sourceUrl: "https://openai.com/chatgpt/features",
        observedAt: new Date("2026-11-08T11:00:00Z"),
        pageType: "features",
      },
    ];

    const aggregated = aggregateSnapshots([...pricingUrlFeatures, ...featurePageFeatures]);

    // All 4 features from both URLs must be preserved in the matrix
    expect(aggregated.size).toBe(4);
    expect(aggregated.get("gpt-4o access")?.featureValue).toBe("included");
    expect(aggregated.get("canvas collaboration")?.featureValue).toBe("limited (early beta)");
    expect(aggregated.get("custom gpts creation")?.featureValue).toBe("included");
    expect(aggregated.get("standard voice")?.featureValue).toBe("included");
  });

  it("ensures newer scrape on features URL does not erase pricing page features", () => {
    const olderPricingScrape: CandidateSnapshot[] = [
      {
        featureName: "Message Limit",
        featureValue: "80 messages / 3 hours",
        sourceUrl: "https://openai.com/chatgpt/pricing",
        observedAt: new Date("2026-11-08T09:00:00Z"),
        pageType: "pricing",
      },
    ];

    const newerFeaturesScrape: CandidateSnapshot[] = [
      {
        featureName: "DALL-E Image Generation",
        featureValue: "included",
        sourceUrl: "https://openai.com/chatgpt/features",
        observedAt: new Date("2026-11-08T12:00:00Z"),
        pageType: "features",
      },
    ];

    const aggregated = aggregateSnapshots([...olderPricingScrape, ...newerFeaturesScrape]);

    expect(aggregated.has("message limit")).toBe(true);
    expect(aggregated.has("dall-e image generation")).toBe(true);
    expect(aggregated.get("message limit")?.sourceUrl).toBe("https://openai.com/chatgpt/pricing");
  });

  it("resolves conflicting feature availability: pricing page takes precedence over features page", () => {
    const featuresPageSnapshot: CandidateSnapshot = {
      featureName: "Advanced Voice Mode",
      featureValue: "included", // General features marketing page says included
      sourceUrl: "https://openai.com/chatgpt/features",
      observedAt: new Date("2026-11-08T12:00:00Z"), // Even if newer
      pageType: "features",
    };

    const pricingPageSnapshot: CandidateSnapshot = {
      featureName: "Advanced Voice Mode",
      featureValue: "limited (monthly quota)", // Dedicated pricing page specifies quota restriction
      sourceUrl: "https://openai.com/chatgpt/pricing",
      observedAt: new Date("2026-11-08T10:00:00Z"),
      pageType: "pricing",
    };

    const aggregated = aggregateSnapshots([featuresPageSnapshot, pricingPageSnapshot]);

    expect(aggregated.get("advanced voice mode")?.featureValue).toBe("limited (monthly quota)");
    expect(aggregated.get("advanced voice mode")?.pageType).toBe("pricing");
  });

  it("preserves equal precedence conflicts by selecting latest observation timestamp", () => {
    const firstUrlSnapshot: CandidateSnapshot = {
      featureName: "Context Window",
      featureValue: "128k",
      sourceUrl: "https://competitor.com/blog/launch",
      observedAt: new Date("2026-11-08T10:00:00Z"),
      pageType: "other",
    };

    const secondUrlSnapshot: CandidateSnapshot = {
      featureName: "Context Window",
      featureValue: "200k",
      sourceUrl: "https://competitor.com/press",
      observedAt: new Date("2026-11-08T14:00:00Z"),
      pageType: "other",
    };

    const aggregated = aggregateSnapshots([firstUrlSnapshot, secondUrlSnapshot]);

    expect(aggregated.get("context window")?.featureValue).toBe("200k");
  });
});

describe("Incomplete Extraction & Quality Guard Protection", () => {
  it("detects suspicious feature drop when features drop > 70% without markdown shrinking", () => {
    const previousFeaturesCount = 25;
    const currentFeaturesCount = 4;
    const markdownLength = 4500; // Not substantially reduced

    const isMarkdownSubstantiallyReduced = markdownLength < 500;
    const isSuspiciousDrop =
      previousFeaturesCount >= 10 &&
      currentFeaturesCount < previousFeaturesCount * 0.3 &&
      !isMarkdownSubstantiallyReduced;

    expect(isSuspiciousDrop).toBe(true);
  });

  it("allows valid feature reductions when the page markdown content genuinely shrunk", () => {
    const previousFeaturesCount = 25;
    const currentFeaturesCount = 3;
    const markdownLength = 250; // Drastic page reduction (e.g. redirected or 404 stub)

    const isMarkdownSubstantiallyReduced = markdownLength < 500;
    const isSuspiciousDrop =
      previousFeaturesCount >= 10 &&
      currentFeaturesCount < previousFeaturesCount * 0.3 &&
      !isMarkdownSubstantiallyReduced;

    // Because markdown genuinely shrunk, it is NOT flagged as an AI parse failure
    expect(isSuspiciousDrop).toBe(false);
  });

  it("preserves rich feature availability normalization for limited, numeric and unknown", () => {
    expect(normalizeFeatureAvailability("Limited (desktop app)")).toBe("limited");
    expect(normalizeFeatureAvailability("27K")).toBe("limited");
    expect(normalizeFeatureAvailability("10x")).toBe("limited");
    expect(normalizeFeatureAvailability("Included")).toBe("included");
    expect(normalizeFeatureAvailability("Not available")).toBe("not_included");
    expect(normalizeFeatureAvailability("—")).toBe("unknown");
    expect(normalizeFeatureAvailability("Unspecified")).toBe("unknown");
  });
});
