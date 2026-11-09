export const GROQ_MODELS = {
  // Primary general reasoning model for high precision JSON schema extraction
  PRIMARY_EXTRACTION: "openai/gpt-oss-120b",
  // High-throughput instruction tuned models
  FAST_EXTRACTION: "openai/gpt-oss-20b",
  QWEN: "qwen/qwen3.8-27b",
} as const;

export const DEFAULT_EXTRACTION_CONFIG = {
  model: process.env.GROQ_MODEL || GROQ_MODELS.QWEN,
  temperature: 0.1, // Near-zero temperature for deterministic extraction & zero hallucinations
  max_tokens: 1000, // Safe default output token cap to strictly respect Groq OTPM limit
  timeout_ms: 120000, // 120s timeout per chunk to comfortably accommodate extensive generation
};
