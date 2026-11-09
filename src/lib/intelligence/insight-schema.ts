import { z } from "zod";

export const InsightTypeEnum = z.enum([
  "pricing",
  "packaging",
  "discount",
  "positioning",
  "market_movement",
]);

export const ImpactLevelEnum = z.enum(["high", "medium", "low"]);

/**
 * Concrete evidence item strictly linking insight claims to observed facts
 */
export const InsightEvidenceItemSchema = z.object({
  claim: z.string().min(1),
  sourceFact: z.string().optional().default("Verified competitor scan"),
  sourceType: z.string().optional().default("scrape_observation"),
  changeType: z.string().optional().nullable(),
  observedPrice: z.string().optional().nullable(),
  observedValue: z.string().optional().nullable(),
  previousValue: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
});

/**
 * Strategic Action Playbook Item
 */
export const ActionRecommendationSchema = z.object({
  action: z.string().min(1),
  priority: z.enum(["immediate", "short_term", "strategic"]).optional().default("short_term"),
  targetDepartment: z.enum(["product", "marketing", "sales", "executive"]).optional().default("product"),
  rationale: z.string().optional().default("Counter competitor maneuver"),
});

/**
 * Playbook by department or list
 */
export const ActionPlaybookSchema = z.union([
  z.array(ActionRecommendationSchema),
  z.object({
    product: z.array(z.string()).default([]),
    pricing: z.array(z.string()).default([]),
    marketing: z.array(z.string()).default([]),
    sales: z.array(z.string()).default([]),
  }),
]);

/**
 * Single Strategic Insight
 */
export const StrategicInsightSchema = z.object({
  title: z.string().min(3).max(255),
  summary: z.string().min(10),
  insightType: z.string().transform((val) => {
    const lower = val.toLowerCase();
    if (["pricing", "packaging", "discount", "positioning", "market_movement"].includes(lower)) {
      return lower;
    }
    return "pricing";
  }).default("pricing"),
  impact: ImpactLevelEnum.default("medium"),
  marketPosture: z.enum(["aggressive", "defensive", "neutral", "expansionary"]).optional().default("neutral"),
  strategicImplications: z.array(z.string()).optional().default([]),
  competitorId: z.string().optional().nullable(),
  competitorName: z.string().optional().nullable(),
  evidenceList: z.array(InsightEvidenceItemSchema).default([]),
  recommendation: z.string().optional().default("Monitor upcoming competitor movements."),
  actionPlaybook: ActionPlaybookSchema.optional().default([]),
  confidenceScore: z.number().min(0).max(1).default(0.9),
});

/**
 * Root LLM Output for Insights Generation
 */
export const StrategicInsightsOutputSchema = z.object({
  analysisSummary: z.string().optional(),
  executiveSummary: z.string().optional(),
  marketPosture: z.string().optional().default("stable"),
  insights: z.array(StrategicInsightSchema).default([]),
}).transform((data) => ({
  ...data,
  analysisSummary: data.analysisSummary || data.executiveSummary || "Analysis complete.",
  executiveSummary: data.executiveSummary || data.analysisSummary || "Analysis complete.",
}));

export type InsightType = z.infer<typeof InsightTypeEnum>;
export type ImpactLevel = z.infer<typeof ImpactLevelEnum>;
export type StrategicInsight = z.infer<typeof StrategicInsightSchema>;
export type StrategicInsightsOutput = z.infer<typeof StrategicInsightsOutputSchema>;
