export class FirecrawlError extends Error {
  public statusCode?: number;
  public code: string;
  public isRetryable: boolean;

  constructor(message: string, code = "FIRECRAWL_ERROR", statusCode?: number, isRetryable = false) {
    super(message);
    this.name = "FirecrawlError";
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export class SSRFValidationError extends FirecrawlError {
  constructor(message: string) {
    super(message, "SSRF_VALIDATION_ERROR", 400, false);
    this.name = "SSRFValidationError";
  }
}

export class FirecrawlRateLimitError extends FirecrawlError {
  constructor(message = "Firecrawl rate limit exceeded") {
    super(message, "RATE_LIMIT_EXCEEDED", 429, true);
    this.name = "FirecrawlRateLimitError";
  }
}

export class FirecrawlTimeoutError extends FirecrawlError {
  constructor(message = "Firecrawl scrape timed out") {
    super(message, "SCRAPE_TIMEOUT", 408, true);
    this.name = "FirecrawlTimeoutError";
  }
}
