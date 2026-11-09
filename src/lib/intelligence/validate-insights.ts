import { StrategicInsightsOutputSchema, StrategicInsightsOutput } from "./insight-schema";
import { ExtractionValidationError } from "../ai/errors";

/**
 * Validates and cleans raw JSON output from Groq into typed StrategicInsightsOutput.
 */
export function validateAndParseInsights(rawResponseText: string): StrategicInsightsOutput {
  if (!rawResponseText || rawResponseText.trim() === "") {
    throw new ExtractionValidationError("LLM returned an empty response for strategic insights.");
  }

  let cleaned = rawResponseText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (err) {
    throw new ExtractionValidationError(
      `Malformed JSON output from model: ${err instanceof Error ? err.message : String(err)}`,
      { raw: rawResponseText }
    );
  }

  // If the model returned an array of insights directly, wrap it
  if (Array.isArray(parsedJson)) {
    parsedJson = {
      analysisSummary: "Generated strategic intelligence analysis from competitor signals.",
      marketPosture: "stable",
      insights: parsedJson,
    };
  }

  const result = StrategicInsightsOutputSchema.safeParse(parsedJson);

  if (!result.success) {
    throw new ExtractionValidationError(
      "Strategic insights failed Zod schema validation.",
      result.error.issues
    );
  }

  return result.data;
}
