import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  competitors,
  pricingPlans,
  pricingChanges,
} from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { successResponse, handleApiError } from "@/lib/api/response";
import { buildPaginationMeta } from "@/types/api-contracts";

const ChangesQuerySchema = z.object({
  competitorId: z.string().optional(),
  pricingPlanId: z.string().optional(),
  changeType: z.string().optional(),
  fieldName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = ChangesQuerySchema.parse(searchParams);

    const conditions: any[] = [];

    if (query.competitorId) {
      conditions.push(eq(pricingChanges.competitorId, query.competitorId));
    }
    if (query.pricingPlanId) {
      conditions.push(eq(pricingChanges.pricingPlanId, query.pricingPlanId));
    }
    if (query.changeType && query.changeType !== "ALL") {
      conditions.push(eq(pricingChanges.changeType, query.changeType));
    }
    if (query.fieldName) {
      conditions.push(eq(pricingChanges.fieldName, query.fieldName));
    }
    if (query.startDate) {
      conditions.push(gte(pricingChanges.detectedAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(pricingChanges.detectedAt, new Date(query.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count query
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pricingChanges)
      .where(whereClause);

    const totalRecords = countResult?.count ?? 0;
    const offset = (query.page - 1) * query.pageSize;

    // Change log rows joined with competitor & plan info
    const changeRows = await db
      .select({
        id: pricingChanges.id,
        competitorId: pricingChanges.competitorId,
        competitorName: competitors.name,
        pricingPlanId: pricingChanges.pricingPlanId,
        planName: pricingPlans.planName,
        changeType: pricingChanges.changeType,
        fieldName: pricingChanges.fieldName,
        oldValue: pricingChanges.oldValue,
        newValue: pricingChanges.newValue,
        absoluteDifference: pricingChanges.absoluteDifference,
        percentageDifference: pricingChanges.percentageDifference,
        description: pricingChanges.description,
        sourceUrl: pricingChanges.sourceUrl,
        detectedAt: pricingChanges.detectedAt,
      })
      .from(pricingChanges)
      .innerJoin(competitors, eq(pricingChanges.competitorId, competitors.id))
      .leftJoin(pricingPlans, eq(pricingChanges.pricingPlanId, pricingPlans.id))
      .where(whereClause)
      .orderBy(desc(pricingChanges.detectedAt))
      .limit(query.pageSize)
      .offset(offset);

    const pagination = buildPaginationMeta(totalRecords, query.page, query.pageSize);

    return successResponse(changeRows, {
      pagination,
      filters: {
        competitorId: query.competitorId || null,
        pricingPlanId: query.pricingPlanId || null,
        changeType: query.changeType || null,
        fieldName: query.fieldName || null,
        startDate: query.startDate || null,
        endDate: query.endDate || null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
