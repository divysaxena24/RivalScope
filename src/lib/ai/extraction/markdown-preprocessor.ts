import { preprocessMarkdownForExtraction } from "../preprocessing";

/**
 * Universal Markdown preprocessor for pricing extraction.
 * Delegates to the intelligence preprocessing layer with safety quality guards.
 */
export function preprocessPricingMarkdown(rawMarkdown: string): string {
  if (!rawMarkdown) return "";
  const result = preprocessMarkdownForExtraction(rawMarkdown);
  return result.preprocessedMarkdown;
}
