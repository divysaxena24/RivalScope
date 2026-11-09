import { getGroqClient } from "@/lib/ai/client";
import { DEFAULT_EXTRACTION_CONFIG, GROQ_MODELS } from "@/lib/ai/model-config";
import {
  STRATEGIC_INSIGHTS_SYSTEM_PROMPT,
  buildCompetitorInsightPrompt,
  buildMarketWideInsightPrompt,
} from "./prompts/strategic-insights";
import { validateAndParseInsights } from "./validate-insights";
import { StrategicInsightsOutput } from "./insight-schema";
import { CompetitorIntelligenceContext, MarketWideIntelligenceContext } from "./types";
import { AIError, GroqRateLimitError, GroqTimeoutError } from "@/lib/ai/errors";

export async function generateCompetitorStrategicInsights(
  ctx: CompetitorIntelligenceContext
): Promise<StrategicInsightsOutput> {
  const groq = getGroqClient();
  const userPrompt = buildCompetitorInsightPrompt(ctx);

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new GroqTimeoutError("Strategic insight generation timed out after 60s.")),
        DEFAULT_EXTRACTION_CONFIG.timeout_ms
      );
    });

    const completionPromise = groq.chat.completions.create({
      model: DEFAULT_EXTRACTION_CONFIG.model,
      messages: [
        { role: "system", content: STRATEGIC_INSIGHTS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: DEFAULT_EXTRACTION_CONFIG.max_tokens,
    });

    const completion: any = await Promise.race([completionPromise, timeoutPromise]);
    const rawContent = completion.choices[0]?.message?.content || "";

    const validated = validateAndParseInsights(rawContent);

    // Attach competitorId if missing from individual items
    for (const insight of validated.insights) {
      if (!insight.competitorId) insight.competitorId = ctx.competitorId;
      if (!insight.competitorName) insight.competitorName = ctx.competitorName;
    }

    return validated;
  } catch (err: any) {
    if (err instanceof AIError) throw err;
    if (err?.status === 429 || (err?.message && err.message.toLowerCase().includes("rate limit"))) {
      throw new GroqRateLimitError(err.message);
    }
    throw new AIError(
      `Groq insights generation error: ${err?.message || String(err)}`,
      err?.code || "INSIGHT_GENERATION_FAILED",
      err?.status || 500
    );
  }
}

export async function generateMarketWideStrategicInsights(
  ctx: MarketWideIntelligenceContext
): Promise<StrategicInsightsOutput> {
  const groq = getGroqClient();
  const userPrompt = buildMarketWideInsightPrompt(ctx);

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new GroqTimeoutError("Market-wide strategic insight generation timed out.")),
        DEFAULT_EXTRACTION_CONFIG.timeout_ms
      );
    });

    const completionPromise = groq.chat.completions.create({
      model: DEFAULT_EXTRACTION_CONFIG.model,
      messages: [
        { role: "system", content: STRATEGIC_INSIGHTS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: DEFAULT_EXTRACTION_CONFIG.max_tokens,
    });

    const completion: any = await Promise.race([completionPromise, timeoutPromise]);
    const rawContent = completion.choices[0]?.message?.content || "";

    return validateAndParseInsights(rawContent);
  } catch (err: any) {
    if (err instanceof AIError) throw err;
    if (err?.status === 429 || (err?.message && err.message.toLowerCase().includes("rate limit"))) {
      throw new GroqRateLimitError(err.message);
    }
    throw new AIError(
      `Groq market insights generation error: ${err?.message || String(err)}`,
      err?.code || "MARKET_INSIGHT_FAILED",
      err?.status || 500
    );
  }
}
