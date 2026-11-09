import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  competitors,
  pricingPlans,
  pricingSnapshots,
} from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { successResponse, handleApiError } from "@/lib/api/response";
import { buildPaginationMeta } from "@/types/api-contracts";

const PriceHistoryQuerySchema = z.object({
  competitorId: z.string().optional(),
  pricingPlanId: z.string().optional(),
  currency: z.string().optional(),
  billingPeriod: z.string().optional(),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(),   // ISO date string
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = PriceHistoryQuerySchema.parse(searchParams);

    const conditions: any[] = [];

    if (query.competitorId) {
      conditions.push(eq(pricingSnapshots.competitorId, query.competitorId));
    }
    if (query.pricingPlanId) {
      conditions.push(eq(pricingSnapshots.pricingPlanId, query.pricingPlanId));
    }
    if (query.currency) {
      conditions.push(eq(pricingSnapshots.currency, query.currency.toUpperCase()));
    }
    if (query.billingPeriod) {
      conditions.push(eq(pricingSnapshots.billingPeriod, query.billingPeriod));
    }
    if (query.startDate) {
      conditions.push(gte(pricingSnapshots.observedAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(pricingSnapshots.observedAt, new Date(query.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total records count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pricingSnapshots)
      .where(whereClause);

    const totalRecords = countResult?.count ?? 0;
    const offset = (query.page - 1) * query.pageSize;

    // Fetch snapshot history joined with competitor and plan
    const historyRows = await db
      .select({
        id: pricingSnapshots.id,
        competitorId: pricingSnapshots.competitorId,
        competitorName: competitors.name,
        pricingPlanId: pricingSnapshots.pricingPlanId,
        planName: pricingSnapshots.planName,
        price: pricingSnapshots.price,
        currency: pricingSnapshots.currency,
        billingPeriod: pricingSnapshots.billingPeriod,
        sourceUrl: pricingSnapshots.sourceUrl,
        features: pricingSnapshots.features,
        usageLimits: pricingSnapshots.usageLimits,
        observedAt: pricingSnapshots.observedAt,
      })
      .from(pricingSnapshots)
      .innerJoin(competitors, eq(pricingSnapshots.competitorId, competitors.id))
      .where(whereClause)
      .orderBy(desc(pricingSnapshots.observedAt))
      .limit(query.pageSize)
      .offset(offset);

    const pagination = buildPaginationMeta(totalRecords, query.page, query.pageSize);

    return successResponse(historyRows, {
      pagination,
      filters: {
        competitorId: query.competitorId || null,
        pricingPlanId: query.pricingPlanId || null,
        currency: query.currency || null,
        billingPeriod: query.billingPeriod || null,
        startDate: query.startDate || null,
        endDate: query.endDate || null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
