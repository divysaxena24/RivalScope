import { db, aiInsights } from "@/lib/db";
import { StrategicInsight } from "./insight-schema";

/**
 * Persists validated strategic insights into the PostgreSQL ai_insights table.
 */
export async function persistStrategicInsights(
  insights: StrategicInsight[],
  defaultCompetitorId?: string | null
): Promise<{ insertedCount: number; records: any[] }> {
  if (insights.length === 0) {
    return { insertedCount: 0, records: [] };
  }

  const savedRecords: any[] = [];
  const now = new Date();

  for (const ins of insights) {
    const compId = ins.competitorId || defaultCompetitorId || null;

    const [inserted] = await db
      .insert(aiInsights)
      .values({
        competitorId: compId,
        title: ins.title,
        summary: ins.summary,
        insightType: ins.insightType,
        impact: ins.impact,
        evidence: {
          evidenceList: ins.evidenceList,
          confidenceScore: ins.confidenceScore,
          actionPlaybook: ins.actionPlaybook,
        },
        recommendation: ins.recommendation,
        generatedAt: now,
      })
      .returning();

    savedRecords.push(inserted);
  }

  return {
    insertedCount: savedRecords.length,
    records: savedRecords,
  };
}
