import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  competitors,
  pricingPlans,
  pricingSnapshots,
  pricingChanges,
} from "@/lib/db/schema";
import { eq, and, gte, lte, asc, sql, isNotNull } from "drizzle-orm";
import { successResponse, handleApiError } from "@/lib/api/response";
import { PricingTrendsQuerySchema, SUPPORTED_CURRENCIES } from "@/types/pricing-trends";

export { PricingTrendsQuerySchema, SUPPORTED_CURRENCIES };

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = PricingTrendsQuerySchema.parse(searchParams);

    const conditions: any[] = [
      isNotNull(pricingSnapshots.price), // Must have a recorded numeric price
    ];

    if (query.competitorId && query.competitorId !== "all") {
      conditions.push(eq(pricingSnapshots.competitorId, query.competitorId));
    }
    if (query.pricingPlanId && query.pricingPlanId !== "all") {
      conditions.push(eq(pricingSnapshots.pricingPlanId, query.pricingPlanId));
    }
    if (query.currency && query.currency !== "ALL") {
      conditions.push(eq(pricingSnapshots.currency, query.currency));
    }
    if (query.billingPeriod && query.billingPeriod !== "all") {
      conditions.push(eq(pricingSnapshots.billingPeriod, query.billingPeriod));
    }
    if (query.startDate) {
      conditions.push(gte(pricingSnapshots.observedAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(pricingSnapshots.observedAt, new Date(query.endDate)));
    }

    const whereClause = and(...conditions);

    // Query ordered chronologically ascending so trends represent timeline progression
    const snapshots = await db
      .select({
        snapshotId: pricingSnapshots.id,
        competitorId: pricingSnapshots.competitorId,
        competitorName: competitors.name,
        pricingPlanId: pricingSnapshots.pricingPlanId,
        planName: pricingSnapshots.planName,
        price: pricingSnapshots.price,
        currency: pricingSnapshots.currency,
        billingPeriod: pricingSnapshots.billingPeriod,
        observedAt: pricingSnapshots.observedAt,
      })
      .from(pricingSnapshots)
      .innerJoin(competitors, eq(pricingSnapshots.competitorId, competitors.id))
      .where(whereClause)
      .orderBy(asc(pricingSnapshots.observedAt))
      .limit(query.limit);

    // Group observations by plan/competitor and build trend timeline
    const observations = snapshots.map((s) => ({
      snapshotId: s.snapshotId,
      competitorId: s.competitorId,
      competitorName: s.competitorName,
      pricingPlanId: s.pricingPlanId,
      planName: s.planName,
      price: parseFloat(s.price || "0"),
      priceFormatted: `${s.currency === "EUR" ? "€" : s.currency === "GBP" ? "£" : s.currency === "INR" ? "₹" : "$"}${s.price}`,
      currency: s.currency || "USD",
      billingPeriod: s.billingPeriod || "monthly",
      observedAt: s.observedAt.toISOString(),
      dateLabel: s.observedAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    }));

    // Calculate plan-level observation counts to identify if sufficient history exists (>1 observation)
    const planCounts = new Map<string, number>();
    observations.forEach((o) => {
      const key = o.pricingPlanId || o.planName;
      planCounts.set(key, (planCounts.get(key) || 0) + 1);
    });

    const hasMultiObservationTrend = Array.from(planCounts.values()).some((c) => c > 1);

    // Query detected price changes within the same scope to serve as visual chart annotations
    const changeConditions: any[] = [
      sql`upper(${pricingChanges.changeType}) in ('PRICE_INCREASED', 'PRICE_DECREASED', 'PRICE_BECAME_FREE', 'PRICE_NO_LONGER_FREE')`,
    ];
    if (query.competitorId && query.competitorId !== "all") {
      changeConditions.push(eq(pricingChanges.competitorId, query.competitorId));
    }
    if (query.pricingPlanId && query.pricingPlanId !== "all") {
      changeConditions.push(eq(pricingChanges.pricingPlanId, query.pricingPlanId));
    }
    if (query.startDate) {
      changeConditions.push(gte(pricingChanges.detectedAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      changeConditions.push(lte(pricingChanges.detectedAt, new Date(query.endDate)));
    }

    const priceChangesList = await db
      .select({
        id: pricingChanges.id,
        competitorId: pricingChanges.competitorId,
        pricingPlanId: pricingChanges.pricingPlanId,
        changeType: pricingChanges.changeType,
        oldValue: pricingChanges.oldValue,
        newValue: pricingChanges.newValue,
        absoluteDifference: pricingChanges.absoluteDifference,
        percentageDifference: pricingChanges.percentageDifference,
        description: pricingChanges.description,
        sourceUrl: pricingChanges.sourceUrl,
        detectedAt: pricingChanges.detectedAt,
      })
      .from(pricingChanges)
      .where(and(...changeConditions))
      .orderBy(asc(pricingChanges.detectedAt))
      .limit(50);

    return successResponse({
      observations,
      annotations: priceChangesList.map((c) => ({
        id: c.id,
        competitorId: c.competitorId,
        pricingPlanId: c.pricingPlanId,
        changeType: c.changeType,
        oldValue: c.oldValue,
        newValue: c.newValue,
        absoluteDifference: c.absoluteDifference,
        percentageDifference: c.percentageDifference,
        description: c.description,
        sourceUrl: c.sourceUrl,
        detectedAt: c.detectedAt.toISOString(),
      })),
      metadata: {
        totalObservations: observations.length,
        distinctPlansCount: planCounts.size,
        hasMultiObservationTrend,
        currency: query.currency,
        billingPeriod: query.billingPeriod,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      },
    }, {
      filters: {
        competitorId: query.competitorId || null,
        pricingPlanId: query.pricingPlanId || null,
        currency: query.currency,
        billingPeriod: query.billingPeriod,
        startDate: query.startDate || null,
        endDate: query.endDate || null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
