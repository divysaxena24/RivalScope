import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  competitors,
  aiInsights,
} from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { successResponse, handleApiError } from "@/lib/api/response";
import { buildPaginationMeta } from "@/types/api-contracts";

const InsightsQuerySchema = z.object({
  impact: z.enum(["all", "high", "medium", "low"]).default("all"),
  category: z.string().optional(),
  insightType: z.string().optional(),
  competitorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = InsightsQuerySchema.parse(searchParams);

    const conditions: any[] = [];

    if (query.impact !== "all") {
      conditions.push(eq(aiInsights.impact, query.impact));
    }
    const type = query.insightType || query.category;
    if (type && type !== "all") {
      conditions.push(eq(aiInsights.insightType, type));
    }
    if (query.competitorId) {
      conditions.push(eq(aiInsights.competitorId, query.competitorId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiInsights)
      .where(whereClause);

    const totalRecords = countResult?.count ?? 0;
    const offset = (query.page - 1) * query.pageSize;

    const rawResults = await db
      .select({
        id: aiInsights.id,
        competitorId: aiInsights.competitorId,
        competitorName: competitors.name,
        insightType: aiInsights.insightType,
        title: aiInsights.title,
        summary: aiInsights.summary,
        impact: aiInsights.impact,
        evidence: aiInsights.evidence,
        recommendation: aiInsights.recommendation,
        generatedAt: aiInsights.generatedAt,
      })
      .from(aiInsights)
      .leftJoin(competitors, eq(aiInsights.competitorId, competitors.id))
      .where(whereClause)
      .orderBy(desc(aiInsights.generatedAt))
      .limit(query.pageSize)
      .offset(offset);

    // Transform to standard structured object with typed evidence
    const formatted = rawResults.map((row) => {
      const evidenceObj = (row.evidence || {}) as Record<string, any>;
      return {
        id: row.id,
        competitorId: row.competitorId,
        competitorName: row.competitorName,
        category: row.insightType,
        insightType: row.insightType,
        title: row.title,
        summary: row.summary,
        impact: row.impact,
        recommendation: row.recommendation,
        evidenceList: evidenceObj.evidenceList || [],
        actionPlaybook: evidenceObj.actionPlaybook || [],
        confidenceScore: evidenceObj.confidenceScore ?? 0.9,
        createdAt: row.generatedAt.toISOString(),
      };
    });

    const pagination = buildPaginationMeta(totalRecords, query.page, query.pageSize);

    return successResponse(formatted, {
      pagination,
      filters: {
        impact: query.impact,
        category: type || null,
        competitorId: query.competitorId || null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
