/**
 * Model token budget and rate limit specifications.
 * Allows safe multi-pass extraction budgeting based on exact configured Groq model.
 */

export interface ModelTokenBudget {
  modelName: string;
  maxContextTokens: number;
  inputTokenPerMinuteLimit: number;
  systemPromptBudgetTokens: number;
  responseTokensReserved: number;
  safetyMarginTokens: number;
  /** Max allowed tokens in markdown per single LLM call */
  maxChunkInputTokens: number;
}

export const MODEL_TOKEN_CONFIGS: Record<string, { maxContext: number; itpm: number; otpm: number }> = {
  "qwen/qwen3.8-27b": { maxContext: 32768, itpm: 7000, otpm: 1000 },
  "openai/gpt-oss-120b": { maxContext: 32768, itpm: 8000, otpm: 1000 },
  "openai/gpt-oss-20b": { maxContext: 32768, itpm: 8000, otpm: 1000 },
  "llama-3.3-70b-versatile": { maxContext: 32768, itpm: 12000, otpm: 1000 },
  "default": { maxContext: 16384, itpm: 7000, otpm: 1000 },
};

/**
 * Calculates safe markdown chunk token budget for a given model.
 */
export function getModelTokenBudget(modelName: string): ModelTokenBudget {
  const cfg = MODEL_TOKEN_CONFIGS[modelName] || MODEL_TOKEN_CONFIGS["default"];

  // System prompt + base schema instructions take ~1,400 tokens
  const systemPromptBudgetTokens = 1400;
  // Reserve safety margin for user prompt wrapper, title, URL, etc.
  const safetyMarginTokens = 400;

  // Groq on-demand enforces strict Input Tokens Per Minute (ITPM) or TPM limits:
  // To avoid both rate-limit 413 and timeout/empty generation, cap chunk tokens to ~2,200 tokens (~7,500 chars)
  const maxChunkInputTokens = Math.min(2200, cfg.itpm - systemPromptBudgetTokens - safetyMarginTokens - 200);

  return {
    modelName,
    maxContextTokens: cfg.maxContext,
    inputTokenPerMinuteLimit: cfg.itpm,
    systemPromptBudgetTokens,
    responseTokensReserved: Math.min(cfg.otpm, 1000),
    safetyMarginTokens,
    maxChunkInputTokens,
  };
}

/**
 * Fast approximate token estimator for markdown text:
 * Standard English & code averages ~3.6 - 4.0 chars per token.
 * We use 3.5 chars/token conservatively so we never underestimate.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}
