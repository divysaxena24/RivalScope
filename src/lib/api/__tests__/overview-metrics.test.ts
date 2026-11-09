import { describe, it, expect } from "vitest";

describe("Overview Price Changes KPI Aggregation Logic", () => {
  // Simulate the classification rules implemented in /api/dashboard/overview/route.ts
  function classifyChange(changeType: string): "PRICE_HIKE" | "PRICE_DROP" | "OTHER" {
    const upper = changeType.toUpperCase();
    if (upper === "PRICE_INCREASED" || upper === "PRICE_NO_LONGER_FREE") {
      return "PRICE_HIKE";
    }
    if (upper === "PRICE_DECREASED" || upper === "PRICE_BECAME_FREE") {
      return "PRICE_DROP";
    }
    return "OTHER";
  }

  function computeKpis(changes: Array<{ changeType: string; detectedAt: Date }>, windowDays = 30) {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const recent = changes.filter((c) => c.detectedAt >= cutoff);

    let priceIncreases = 0;
    let priceDecreases = 0;
    let otherChanges = 0;

    for (const c of recent) {
      const classification = classifyChange(c.changeType);
      if (classification === "PRICE_HIKE") priceIncreases++;
      else if (classification === "PRICE_DROP") priceDecreases++;
      else otherChanges++;
    }

    return {
      priceChangesTotal: priceIncreases + priceDecreases,
      allEventsTotal: recent.length,
      priceIncreases,
      priceDecreases,
      otherChanges,
    };
  }

  it("accurately classifies uppercase PRICE_INCREASED as a price hike", () => {
    const changes = [
      { changeType: "PRICE_INCREASED", detectedAt: new Date() },
      { changeType: "PRICE_NO_LONGER_FREE", detectedAt: new Date() },
    ];
    const kpis = computeKpis(changes);
    expect(kpis.priceIncreases).toBe(2);
    expect(kpis.priceDecreases).toBe(0);
    expect(kpis.priceChangesTotal).toBe(2);
  });

  it("accurately classifies uppercase PRICE_DECREASED and PRICE_BECAME_FREE as price drops", () => {
    const changes = [
      { changeType: "PRICE_DECREASED", detectedAt: new Date() },
      { changeType: "PRICE_BECAME_FREE", detectedAt: new Date() },
    ];
    const kpis = computeKpis(changes);
    expect(kpis.priceIncreases).toBe(0);
    expect(kpis.priceDecreases).toBe(2);
    expect(kpis.priceChangesTotal).toBe(2);
  });

  it("excludes non-price changes (PLAN_ADDED, FEATURE_ADDED) from qualifying price changes total", () => {
    const changes = [
      { changeType: "PRICE_INCREASED", detectedAt: new Date() },
      { changeType: "PLAN_ADDED", detectedAt: new Date() },
      { changeType: "PLAN_REMOVED", detectedAt: new Date() },
      { changeType: "FEATURE_ADDED", detectedAt: new Date() },
      { changeType: "FEATURE_REMOVED", detectedAt: new Date() },
      { changeType: "CURRENCY_CHANGED", detectedAt: new Date() },
    ];
    const kpis = computeKpis(changes);
    expect(kpis.priceIncreases).toBe(1);
    expect(kpis.priceDecreases).toBe(0);
    expect(kpis.priceChangesTotal).toBe(1); // Only the actual price increase counts
    expect(kpis.allEventsTotal).toBe(6);
    expect(kpis.otherChanges).toBe(5);
  });

  it("respects the 30-day time window for price change calculation", () => {
    const now = Date.now();
    const changes = [
      { changeType: "PRICE_INCREASED", detectedAt: new Date(now - 5 * 24 * 60 * 60 * 1000) }, // 5 days ago
      { changeType: "PRICE_DECREASED", detectedAt: new Date(now - 15 * 24 * 60 * 60 * 1000) }, // 15 days ago
      { changeType: "PRICE_INCREASED", detectedAt: new Date(now - 45 * 24 * 60 * 60 * 1000) }, // 45 days ago (outside 30d)
    ];
    const kpis = computeKpis(changes, 30);
    expect(kpis.priceChangesTotal).toBe(2);
    expect(kpis.priceIncreases).toBe(1);
    expect(kpis.priceDecreases).toBe(1);
  });
});
