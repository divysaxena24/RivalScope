import { getGroqClient } from "../client";
import { DEFAULT_EXTRACTION_CONFIG } from "../model-config";
import {
  PRICING_EXTRACTION_SYSTEM_PROMPT,
  buildPricingExtractionUserPrompt,
} from "../prompts/pricing-extraction";
import { validateAndParseExtraction } from "./validate-extraction";
import { normalizeExtractionResult } from "./normalize-pricing";
import { NormalizedExtractionResult } from "./types";
import { preprocessPricingMarkdown } from "./markdown-preprocessor";
import { getModelTokenBudget, estimateTokens } from "./token-budget";
import { chunkMarkdownForExtraction, MarkdownChunk } from "./markdown-chunker";
import { mergeExtractionPasses } from "./merge-extractions";
import {
  AIError,
  GroqRateLimitError,
  GroqTimeoutError,
  InsufficientContentError,
} from "../errors";

export interface ExtractPricingParams {
  url: string;
  markdown: string;
  pageTitle?: string | null;
  competitorName?: string;
  model?: string;
}

/**
 * Executes a single Groq extraction call on a chunk with bounded exponential backoff
 */
async function executeSingleChunkExtraction(params: {
  url: string;
  chunk: MarkdownChunk;
  pageTitle?: string | null;
  competitorName?: string;
  model: string;
  maxTokens: number;
}): Promise<NormalizedExtractionResult> {
  const { url, chunk, pageTitle, competitorName, model, maxTokens } = params;
  const groq = getGroqClient();

  const userPrompt = buildPricingExtractionUserPrompt({
    url,
    markdown: chunk.content,
    pageTitle: `${pageTitle || "N/A"}${chunk.totalChunks > 1 ? ` [Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}: ${chunk.title}]` : ""}`,
    competitorName,
  });

  let retry = 0;
  const maxRetries = 2;

  while (retry <= maxRetries) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new GroqTimeoutError("Groq extraction request timed out after 120s.")),
          DEFAULT_EXTRACTION_CONFIG.timeout_ms
        );
      });

      const completionPromise = groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: PRICING_EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: DEFAULT_EXTRACTION_CONFIG.temperature,
        max_tokens: maxTokens,
      });

      const completion: any = await Promise.race([completionPromise, timeoutPromise]);
      const rawContent = completion.choices[0]?.message?.content || "";

      // Validate with Zod
      const validated = validateAndParseExtraction(rawContent);

      // Deterministic Normalization
      return normalizeExtractionResult(validated);
    } catch (err: any) {
      const isRateLimit =
        err?.status === 429 ||
        err?.status === 413 ||
        (err?.message && (err.message.toLowerCase().includes("rate limit") || err.message.toLowerCase().includes("quota")));

      if (isRateLimit && retry < maxRetries) {
        retry++;
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 2000 * retry));
        continue;
      }

      if (err instanceof AIError) {
        throw err;
      }

      if (isRateLimit) {
        throw new GroqRateLimitError(err.message || "Groq rate limit exceeded");
      }

      throw new AIError(
        `Groq extraction error: ${err?.message || String(err)}`,
        err?.code || "EXTRACTION_FAILED",
        err?.status || 500
      );
    }
  }

  throw new GroqRateLimitError("Max extraction retries reached on chunk");
}

/**
 * Universal Token-Budget-Aware Multi-Pass Extraction:
 * 1. Preprocesses scraped markdown (strips navigation noise while preserving pricing structures).
 * 2. Checks token budget according to the configured model.
 * 3. Splits into semantic chunks keeping tables & plan headings together.
 * 4. Extracts structured data per chunk.
 * 5. Deterministically merges multi-pass results without data loss.
 */
export async function extractPricingFromMarkdown(
  params: ExtractPricingParams
): Promise<NormalizedExtractionResult> {
  const { url, markdown, pageTitle, competitorName, model = DEFAULT_EXTRACTION_CONFIG.model } = params;

  if (!markdown || markdown.trim().length < 20) {
    throw new InsufficientContentError(
      "Scraped markdown is empty or too short to extract pricing information."
    );
  }

  // 1. Preprocess raw markdown
  const preprocessed = preprocessPricingMarkdown(markdown);
  const cleanMarkdown = preprocessed.length >= 20 ? preprocessed : markdown;

  // 2. Determine model token budget
  const budget = getModelTokenBudget(model);

  // 3. Chunk markdown if needed
  const chunks = chunkMarkdownForExtraction(cleanMarkdown, budget);

  // 4. Multi-pass execution
  const chunkResults: NormalizedExtractionResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Throttle spacing between chunks to maintain aggregate ITPM / RPM within Groq limits
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const result = await executeSingleChunkExtraction({
      url,
      chunk,
      pageTitle,
      competitorName,
      model,
      maxTokens: budget.responseTokensReserved,
    });
    chunkResults.push(result);
  }

  // 5. Merge results across chunks
  return mergeExtractionPasses(chunkResults);
}
