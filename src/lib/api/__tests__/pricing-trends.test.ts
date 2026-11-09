import { describe, it, expect } from "vitest";
import { PricingTrendsQuerySchema, SUPPORTED_CURRENCIES } from "../../../types/pricing-trends";

interface RawObservation {
  snapshotId: string;
  competitorId: string;
  planName: string;
  price: string;
  currency: string;
  billingPeriod: string;
  observedAt: Date;
}

function processTrends(
  rawSnapshots: RawObservation[],
  filterCurrency: string,
  filterPeriod: string
) {
  // Incompatible billing period or currency filtering
  const filtered = rawSnapshots.filter(
    (s) =>
      s.currency.toUpperCase() === filterCurrency.toUpperCase() &&
      s.billingPeriod.toLowerCase() === filterPeriod.toLowerCase()
  );

  // Chronological sort
  const sorted = [...filtered].sort(
    (a, b) => a.observedAt.getTime() - b.observedAt.getTime()
  );

  const planCounts = new Map<string, number>();
  sorted.forEach((o) => {
    planCounts.set(o.planName, (planCounts.get(o.planName) || 0) + 1);
  });

  const hasMultiObservationTrend = Array.from(planCounts.values()).some((c) => c > 1);

  return {
    observations: sorted.map((s) => ({
      ...s,
      numericPrice: parseFloat(s.price),
    })),
    hasMultiObservationTrend,
  };
}

describe("Pricing Trend Data Processing & Validation", () => {
  it("should apply default query values for currency and billing period", () => {
    const parsed = PricingTrendsQuerySchema.parse({});
    expect(parsed.currency).toBe("USD");
    expect(parsed.billingPeriod).toBe("monthly");
    expect(parsed.limit).toBe(100);
  });

  it("should accept all supported currencies (USD, EUR, GBP, INR)", () => {
    for (const cur of SUPPORTED_CURRENCIES) {
      const parsed = PricingTrendsQuerySchema.parse({ currency: cur.toLowerCase() });
      expect(parsed.currency).toBe(cur);
    }
  });

  it("should reject unsupported currency values like JPY or AUD", () => {
    expect(() =>
      PricingTrendsQuerySchema.parse({ currency: "JPY" })
    ).toThrow(/Unsupported currency/);

    expect(() =>
      PricingTrendsQuerySchema.parse({ currency: "BITCOIN" })
    ).toThrow(/Unsupported currency/);
  });

  it("should reject invalid billing period values", () => {
    expect(() =>
      PricingTrendsQuerySchema.parse({ billingPeriod: "quarterly" })
    ).toThrow();
  });

  it("should sort observations chronologically ascending", () => {
    const raw: RawObservation[] = [
      {
        snapshotId: "s2",
        competitorId: "c1",
        planName: "Pro",
        price: "25.00",
        currency: "USD",
        billingPeriod: "monthly",
        observedAt: new Date("2026-11-05T10:00:00Z"),
      },
      {
        snapshotId: "s1",
        competitorId: "c1",
        planName: "Pro",
        price: "20.00",
        currency: "USD",
        billingPeriod: "monthly",
        observedAt: new Date("2026-10-01T10:00:00Z"),
      },
    ];

    const result = processTrends(raw, "USD", "monthly");
    expect(result.observations[0].snapshotId).toBe("s1");
    expect(result.observations[1].snapshotId).toBe("s2");
    expect(result.observations[0].numericPrice).toBe(20);
    expect(result.observations[1].numericPrice).toBe(25);
    expect(result.hasMultiObservationTrend).toBe(true);
  });

  it("should strictly separate different currencies (e.g. USD vs EUR vs INR)", () => {
    const mixed: RawObservation[] = [
      {
        snapshotId: "s1",
        competitorId: "c1",
        planName: "Pro USD",
        price: "20.00",
        currency: "USD",
        billingPeriod: "monthly",
        observedAt: new Date("2026-10-01T10:00:00Z"),
      },
      {
        snapshotId: "s2",
        competitorId: "c2",
        planName: "Pro INR",
        price: "1600.00",
        currency: "INR",
        billingPeriod: "monthly",
        observedAt: new Date("2026-10-02T10:00:00Z"),
      },
      {
        snapshotId: "s3",
        competitorId: "c3",
        planName: "Pro EUR",
        price: "18.00",
        currency: "EUR",
        billingPeriod: "monthly",
        observedAt: new Date("2026-10-03T10:00:00Z"),
      },
    ];

    const usdResult = processTrends(mixed, "USD", "monthly");
    expect(usdResult.observations).toHaveLength(1);
    expect(usdResult.observations[0].currency).toBe("USD");
    expect(usdResult.observations[0].numericPrice).toBe(20);

    const eurResult = processTrends(mixed, "EUR", "monthly");
    expect(eurResult.observations).toHaveLength(1);
    expect(eurResult.observations[0].currency).toBe("EUR");
    expect(eurResult.observations[0].numericPrice).toBe(18);

    const inrResult = processTrends(mixed, "INR", "monthly");
    expect(inrResult.observations).toHaveLength(1);
    expect(inrResult.observations[0].currency).toBe("INR");
    expect(inrResult.observations[0].numericPrice).toBe(1600);
  });

  it("should separate monthly and annual billing periods without converting", () => {
    const mixed: RawObservation[] = [
      {
        snapshotId: "s1",
        competitorId: "c1",
        planName: "Pro",
        price: "20.00",
        currency: "USD",
        billingPeriod: "monthly",
        observedAt: new Date("2026-10-01T10:00:00Z"),
      },
      {
        snapshotId: "s2",
        competitorId: "c1",
        planName: "Pro Annual",
        price: "200.00",
        currency: "USD",
        billingPeriod: "yearly",
        observedAt: new Date("2026-10-02T10:00:00Z"),
      },
    ];

    const result = processTrends(mixed, "USD", "monthly");
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].billingPeriod).toBe("monthly");
  });

  it("should identify when there is only a baseline observation and not falsely claim a trend", () => {
    const single: RawObservation[] = [
      {
        snapshotId: "s1",
        competitorId: "c1",
        planName: "Plus",
        price: "20.00",
        currency: "USD",
        billingPeriod: "monthly",
        observedAt: new Date("2026-11-01T10:00:00Z"),
      },
    ];

    const result = processTrends(single, "USD", "monthly");
    expect(result.hasMultiObservationTrend).toBe(false);
  });
});
