import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  competitors,
  pricingPlans,
  pricingChanges,
  trackedUrls,
} from "@/lib/db/schema";
import { sql, ilike, or, eq, and } from "drizzle-orm";
import { successResponse, handleApiError } from "@/lib/api/response";
import { buildPaginationMeta } from "@/types/api-contracts";

const CompetitorsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["all", "active", "scanned", "error"]).default("all"),
  sortBy: z.enum(["name", "plansCount", "recentChangesCount", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = CompetitorsQuerySchema.parse(searchParams);

    const offset = (query.page - 1) * query.pageSize;

    // Filter conditions
    const whereConditions: any[] = [];
    if (query.search && query.search.trim() !== "") {
      const term = `%${query.search.trim()}%`;
      whereConditions.push(
        or(
          ilike(competitors.name, term),
          ilike(competitors.domain, term),
          ilike(competitors.industry, term)
        )
      );
    }

    // Single aggregated SQL query with subqueries to eliminate N+1 problem
    const baseQuery = db
      .select({
        id: competitors.id,
        name: competitors.name,
        domain: competitors.domain,
        website: competitors.website,
        industry: competitors.industry,
        description: competitors.description,
        createdAt: competitors.createdAt,
        updatedAt: competitors.updatedAt,
        // Subquery for plan count
        plansCount: sql<number>`(
          SELECT count(*)::int 
          FROM ${pricingPlans} 
          WHERE ${pricingPlans.competitorId} = ${competitors.id} AND ${pricingPlans.isActive} = true
        )`,
        // Subquery for recent changes count (30 days)
        recentChangesCount: sql<number>`(
          SELECT count(*)::int 
          FROM ${pricingChanges} 
          WHERE ${pricingChanges.competitorId} = ${competitors.id}
        )`,
        // Subquery for latest scan status
        lastScanStatus: sql<string | null>`(
          SELECT ${trackedUrls.lastScanStatus}
          FROM ${trackedUrls}
          WHERE ${trackedUrls.competitorId} = ${competitors.id}
          ORDER BY ${trackedUrls.lastScannedAt} DESC NULLS LAST
          LIMIT 1
        )`,
        // Subquery for latest scan time
        lastScannedAt: sql<Date | null>`(
          SELECT ${trackedUrls.lastScannedAt}
          FROM ${trackedUrls}
          WHERE ${trackedUrls.competitorId} = ${competitors.id}
          ORDER BY ${trackedUrls.lastScannedAt} DESC NULLS LAST
          LIMIT 1
        )`,
        // Subquery for latest extraction timestamp
        latestExtractionAt: sql<Date | null>`(
          SELECT max(${pricingPlans.updatedAt})
          FROM ${pricingPlans}
          WHERE ${pricingPlans.competitorId} = ${competitors.id}
        )`,
      })
      .from(competitors);

    const filteredQuery = whereConditions.length > 0
      ? baseQuery.where(and(...whereConditions))
      : baseQuery;

    // Count total matches
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(competitors)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const totalRecords = countResult?.count ?? 0;

    // Dynamic sorting
    let orderExpression: any;
    if (query.sortBy === "name") {
      orderExpression = query.sortOrder === "asc" ? sql`${competitors.name} ASC` : sql`${competitors.name} DESC`;
    } else if (query.sortBy === "plansCount") {
      orderExpression = query.sortOrder === "asc" ? sql`"plansCount" ASC` : sql`"plansCount" DESC`;
    } else if (query.sortBy === "recentChangesCount") {
      orderExpression = query.sortOrder === "asc" ? sql`"recentChangesCount" ASC` : sql`"recentChangesCount" DESC`;
    } else {
      orderExpression = query.sortOrder === "asc" ? sql`${competitors.createdAt} ASC` : sql`${competitors.createdAt} DESC`;
    }

    const items = await filteredQuery
      .orderBy(orderExpression)
      .limit(query.pageSize)
      .offset(offset);

    const pagination = buildPaginationMeta(totalRecords, query.page, query.pageSize);

    return successResponse(items, {
      pagination,
      filters: {
        search: query.search || null,
        status: query.status,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
