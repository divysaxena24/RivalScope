import {
  buildCompetitorIntelligenceContext,
  buildMarketWideIntelligenceContext,
} from "./context-builder";
import {
  generateCompetitorStrategicInsights,
  generateMarketWideStrategicInsights,
} from "./generate-insights";
import { persistStrategicInsights } from "./persist-insights";
import { StrategicInsightsOutput } from "./insight-schema";

export interface PipelineInsightResult {
  success: boolean;
  insightsGenerated: number;
  persistedCount: number;
  executiveSummary: string;
  insights: StrategicInsightsOutput["insights"];
  dataCoverage?: {
    plansCount: number;
    changesCount: number;
    scrapesCount: number;
  };
}

/**
 * Executes strategic intelligence generation for a single competitor.
 */
export async function runCompetitorInsightsPipeline(
  competitorId: string
): Promise<PipelineInsightResult> {
  const context = await buildCompetitorIntelligenceContext(competitorId);

  if (!context) {
    return {
      success: false,
      insightsGenerated: 0,
      persistedCount: 0,
      executiveSummary: `Competitor with ID ${competitorId} was not found.`,
      insights: [],
    };
  }

  // If there are no plans and no changes recorded yet
  if (context.activePlans.length === 0 && context.recentChanges.length === 0) {
    return {
      success: true,
      insightsGenerated: 0,
      persistedCount: 0,
      executiveSummary: `No active pricing plans or recent changes recorded yet for ${context.competitorName}. Perform a scan and extraction first.`,
      insights: [],
      dataCoverage: {
        plansCount: 0,
        changesCount: 0,
        scrapesCount: context.recentScrapes.length,
      },
    };
  }

  const generated = await generateCompetitorStrategicInsights(context);
  const persisted = await persistStrategicInsights(generated.insights, context.competitorId);

  return {
    success: true,
    insightsGenerated: generated.insights.length,
    persistedCount: persisted.insertedCount,
    executiveSummary: generated.executiveSummary,
    insights: generated.insights,
    dataCoverage: {
      plansCount: context.activePlans.length,
      changesCount: context.recentChanges.length,
      scrapesCount: context.recentScrapes.length,
    },
  };
}

/**
 * Executes strategic intelligence generation across all competitors in the market.
 */
export async function runMarketWideInsightsPipeline(): Promise<PipelineInsightResult> {
  const context = await buildMarketWideIntelligenceContext();

  if (context.competitors.length === 0) {
    return {
      success: true,
      insightsGenerated: 0,
      persistedCount: 0,
      executiveSummary: "No competitors found in RivalScope database.",
      insights: [],
      dataCoverage: {
        plansCount: 0,
        changesCount: 0,
        scrapesCount: 0,
      },
    };
  }

  const generated = await generateMarketWideStrategicInsights(context);
  const persisted = await persistStrategicInsights(generated.insights);

  return {
    success: true,
    insightsGenerated: generated.insights.length,
    persistedCount: persisted.insertedCount,
    executiveSummary: generated.executiveSummary,
    insights: generated.insights,
    dataCoverage: {
      plansCount: context.totalPlansTracked,
      changesCount: context.totalChangesInWindow,
      scrapesCount: context.competitors.reduce((acc, c) => acc + c.recentScrapes.length, 0),
    },
  };
}
