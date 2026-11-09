import { NextRequest, NextResponse } from "next/server";
import { runCompetitorInsightsPipeline } from "@/lib/intelligence/insight-pipeline";
import { db } from "@/lib/db";
import { aiInsights } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Competitor ID is required" }, { status: 400 });
    }

    const result = await runCompetitorInsightsPipeline(id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error generating competitor insights:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to generate competitor insights",
        code: error.code || "INTERNAL_ERROR",
      },
      { status: error.status || 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Competitor ID is required" }, { status: 400 });
    }

    const insights = await db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.competitorId, id))
      .orderBy(desc(aiInsights.generatedAt))
      .limit(50);

    return NextResponse.json({
      competitorId: id,
      insights,
      count: insights.length,
    });
  } catch (error: any) {
    console.error("Error fetching competitor insights:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch competitor insights" },
      { status: 500 }
    );
  }
}
