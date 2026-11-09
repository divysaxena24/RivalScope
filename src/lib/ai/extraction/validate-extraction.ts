import {
  PricingExtractionOutputSchema,
  PricingExtractionOutput,
} from "./types";
import { ExtractionValidationError } from "../errors";

/**
 * Validates and parses raw text returned by the LLM into typed PricingExtractionOutput.
 * Handles cases where the model returns an object or directly an array of plans.
 */
export function validateAndParseExtraction(
  rawResponseText: string
): PricingExtractionOutput {
  if (!rawResponseText || rawResponseText.trim() === "") {
    throw new ExtractionValidationError("LLM returned an empty response.");
  }

  // Strip codeblock backticks if model wrapped JSON
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

  // If the model returned an array of plans directly, wrap it in the expected root object
  if (Array.isArray(parsedJson)) {
    parsedJson = {
      hasPricing: parsedJson.length > 0,
      status: parsedJson.length > 0 ? "SUCCESS" : "NO_PRICING_FOUND",
      plans: parsedJson,
    };
  }

  const result = PricingExtractionOutputSchema.safeParse(parsedJson);

  if (!result.success) {
    throw new ExtractionValidationError(
      "Extracted pricing output failed Zod schema validation.",
      result.error.issues
    );
  }

  return result.data;
}
