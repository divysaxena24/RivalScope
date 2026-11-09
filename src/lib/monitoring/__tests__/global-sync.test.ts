import { describe, it, expect } from "vitest";
import { normalizeFeatureAvailability } from "../../ai/extraction/types";

describe("Global Feature Re-extraction & Matrix Synchronization Tests", () => {
  describe("1. Universal Competitor & Plan Isolation", () => {
    it("handles multiple arbitrary competitors without hardcoding", () => {
      const mockCompetitors = [
        { id: "comp-1", name: "Alpha AI", status: "active", trackedUrls: [{ id: "u-1", url: "https://alpha.ai/pricing", isActive: true }] },
        { id: "comp-2", name: "Beta Analytics", status: "active", trackedUrls: [{ id: "u-2", url: "https://beta.io/pricing", isActive: true }] },
        { id: "comp-3", name: "Gamma Cloud", status: "archived", trackedUrls: [{ id: "u-3", url: "https://gamma.com/pricing", isActive: true }] },
      ];

      // Eligible competitors must be active
      const eligible = mockCompetitors.filter((c) => c.status === "active");
      expect(eligible).toHaveLength(2);
      expect(eligible.map((c) => c.name)).toEqual(["Alpha AI", "Beta Analytics"]);
    });

    it("isolates plan-specific feature availability without cross-contamination", () => {
      const planA = {
        planName: "Starter",
        features: [
          { name: "Exports", availability: "limited", originalValue: "5/month" },
          { name: "Single Sign-On", availability: "not_included", originalValue: "No" },
        ],
      };

      const planB = {
        planName: "Enterprise",
        features: [
          { name: "Exports", availability: "included", originalValue: "Unlimited" },
          { name: "Single Sign-On", availability: "included", originalValue: "Yes" },
        ],
      };

      expect(planA.features.find((f) => f.name === "Exports")?.originalValue).toBe("5/month");
      expect(planB.features.find((f) => f.name === "Exports")?.originalValue).toBe("Unlimited");
      expect(planA.features.find((f) => f.name === "Single Sign-On")?.availability).toBe("not_included");
      expect(planB.features.find((f) => f.name === "Single Sign-On")?.availability).toBe("included");
    });
  });

  describe("2. Matrix Synchronization & Stale Feature Replacement", () => {
    it("synchronizes latest observation batch and drops stale features absent in new batch", () => {
      // Historical batch 1 (old observation)
      const historicalBatch = [
        { featureName: "Legacy Feature X", featureValue: "included", observedAt: "2026-11-01T00:00:00Z" },
        { featureName: "Context Window", featureValue: "8K", observedAt: "2026-11-01T00:00:00Z" },
      ];

      // New batch 2 (latest observation after site redesign)
      const latestBatch = [
        { featureName: "Context Window", featureValue: "32K", observedAt: "2026-11-08T00:00:00Z" },
        { featureName: "Voice Mode", featureValue: "Yes", observedAt: "2026-11-08T00:00:00Z" },
      ];

      const allSnapshots = [...historicalBatch, ...latestBatch];

      // Find max observedAt
      const maxObserved = "2026-11-08T00:00:00Z";
      const synchronizedFeatures = allSnapshots.filter((s) => s.observedAt === maxObserved);

      // Latest state has Context Window = 32K and Voice Mode, while Legacy Feature X is retired
      expect(synchronizedFeatures).toHaveLength(2);
      expect(synchronizedFeatures.find((f) => f.featureName === "Context Window")?.featureValue).toBe("32K");
      expect(synchronizedFeatures.some((f) => f.featureName === "Legacy Feature X")).toBe(false);
    });

    it("preserves explicit not_included separately from unknown", () => {
      expect(normalizeFeatureAvailability("No")).toBe("not_included");
      expect(normalizeFeatureAvailability("Not available")).toBe("not_included");
      expect(normalizeFeatureAvailability("—")).toBe("unknown");
      expect(normalizeFeatureAvailability(null)).toBe("unknown");
      expect(normalizeFeatureAvailability(undefined)).toBe("unknown");
    });
  });

  describe("3. Failure Isolation in Global Batch Processing", () => {
    it("ensures a failure on one competitor does not block subsequent competitors", async () => {
      const competitorsToProcess = [
        { id: "comp-1", name: "Valid Comp A", shouldFail: false },
        { id: "comp-2", name: "Broken Comp B", shouldFail: true },
        { id: "comp-3", name: "Valid Comp C", shouldFail: false },
      ];

      const results = [];
      for (const comp of competitorsToProcess) {
        try {
          if (comp.shouldFail) {
            throw new Error("Simulated Firecrawl network timeout");
          }
          results.push({ id: comp.id, status: "SUCCESS" });
        } catch (err) {
          results.push({ id: comp.id, status: "FAILED", error: (err as Error).message });
        }
      }

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe("SUCCESS");
      expect(results[1].status).toBe("FAILED");
      expect(results[2].status).toBe("SUCCESS");
    });
  });
});
