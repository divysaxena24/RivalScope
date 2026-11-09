export class AIError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code = "AI_ERROR", statusCode = 500) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class GroqRateLimitError extends AIError {
  constructor(message = "Groq rate limit exceeded. Please retry shortly.") {
    super(message, "GROQ_RATE_LIMIT", 429);
    this.name = "GroqRateLimitError";
  }
}

export class GroqTimeoutError extends AIError {
  constructor(message = "Groq LLM extraction timed out.") {
    super(message, "GROQ_TIMEOUT", 408);
    this.name = "GroqTimeoutError";
  }
}

export class ExtractionValidationError extends AIError {
  public details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message, "EXTRACTION_VALIDATION_ERROR", 422);
    this.name = "ExtractionValidationError";
    this.details = details;
  }
}

export class InsufficientContentError extends AIError {
  constructor(message = "Page contains insufficient content for pricing extraction.") {
    super(message, "INSUFFICIENT_CONTENT", 400);
    this.name = "InsufficientContentError";
  }
}
