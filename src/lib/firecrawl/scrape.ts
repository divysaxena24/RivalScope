import crypto from "crypto";
import { getFirecrawlClient } from "./client";
import { ScrapeOptions, ScrapedPageData, ScrapeResult } from "./types";
import {
  FirecrawlError,
  FirecrawlRateLimitError,
  FirecrawlTimeoutError,
  SSRFValidationError,
} from "./errors";

/**
 * Validates URLs against SSRF vulnerabilities (loopback, RFC1918 private IPv4, link-local, broadcast).
 */
export function validateUrlForSSRF(targetUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl.trim());
  } catch {
    throw new SSRFValidationError("Invalid URL format.");
  }

  // Enforce http or https protocol only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SSRFValidationError(
      `Unsupported protocol '${parsed.protocol}'. Only http: and https: are permitted.`
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and standard aliases
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new SSRFValidationError("Access to local domains is prohibited.");
  }

  // IPv4 SSRF checks
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4Match) {
    const [_, o1, o2, o3, o4] = ipv4Match.map(Number);

    // 127.0.0.0/8 (Loopback)
    if (o1 === 127) {
      throw new SSRFValidationError("Access to loopback IP addresses is prohibited.");
    }
    // 10.0.0.0/8 (Private)
    if (o1 === 10) {
      throw new SSRFValidationError("Access to private IP range 10.0.0.0/8 is prohibited.");
    }
    // 172.16.0.0/12 (Private)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) {
      throw new SSRFValidationError("Access to private IP range 172.16.0.0/12 is prohibited.");
    }
    // 192.168.0.0/16 (Private)
    if (o1 === 192 && o2 === 168) {
      throw new SSRFValidationError("Access to private IP range 192.168.0.0/16 is prohibited.");
    }
    // 169.254.0.0/16 (Link-local)
    if (o1 === 169 && o2 === 254) {
      throw new SSRFValidationError("Access to link-local IP addresses is prohibited.");
    }
    // 0.0.0.0/8 or 255.255.255.255
    if (o1 === 0 || (o1 === 255 && o2 === 255 && o3 === 255 && o4 === 255)) {
      throw new SSRFValidationError("Access to reserved broadcast/unspecified IP is prohibited.");
    }
  }

  // IPv6 loopback / unique local
  if (
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("fc00:") ||
    hostname.startsWith("fd00:") ||
    hostname.startsWith("fe80:")
  ) {
    throw new SSRFValidationError("Access to IPv6 private/loopback addresses is prohibited.");
  }

  return parsed;
}

/**
 * Computes deterministic SHA-256 content hash of the markdown text
 */
export function calculateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content.trim()).digest("hex");
}

/**
 * Scrapes a single URL via Firecrawl with timeout & retry handling.
 */
export async function scrapePage(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const { timeoutMs = 45000, maxRetries = 2, onlyMainContent = true } = options;

  try {
    // 1. SSRF Check
    validateUrlForSSRF(url);

    const client = getFirecrawlClient();

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts <= maxRetries) {
      attempts++;
      try {
        // Wrap Firecrawl call with a timeout promise
        const scrapePromise = client.scrapeUrl(url, {
          formats: ["markdown"],
          onlyMainContent,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new FirecrawlTimeoutError(`Scrape timed out after ${timeoutMs}ms`)),
            timeoutMs
          );
        });

        const response: any = await Promise.race([scrapePromise, timeoutPromise]);

        if (!response || !response.success) {
          const errorMessage =
            response?.error || response?.message || "Firecrawl failed to scrape the page";
          throw new FirecrawlError(errorMessage, "SCRAPE_FAILED");
        }

        const markdown = response.markdown || response.data?.markdown || "";
        const metadata = response.metadata || response.data?.metadata || {};
        const title = metadata.title || response.data?.title || null;
        const contentHash = calculateContentHash(markdown);

        const data: ScrapedPageData = {
          url,
          markdown,
          title,
          metadata,
          contentHash,
          statusCode: metadata.statusCode || 200,
          scrapedAt: new Date(),
        };

        return {
          success: true,
          data,
        };
      } catch (err: any) {
        lastError = err;

        // If error is an SSRFValidationError or permanent 4xx, do not retry
        if (err instanceof SSRFValidationError) {
          return {
            success: false,
            error: err.message,
            code: err.code,
            statusCode: 400,
          };
        }

        const isRateLimit =
          err?.status === 429 ||
          err?.statusCode === 429 ||
          err instanceof FirecrawlRateLimitError ||
          (typeof err?.message === "string" && err.message.toLowerCase().includes("rate limit"));

        if (isRateLimit && attempts <= maxRetries) {
          // Exponential backoff with jitter
          await new Promise((r) => setTimeout(r, 1500 * attempts));
          continue;
        }

        const isTimeout = err instanceof FirecrawlTimeoutError;
        if (isTimeout && attempts <= maxRetries) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        // Other transient network errors
        if (attempts <= maxRetries) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || "Scrape failed after retries",
      code: (lastError as any)?.code || "SCRAPE_FAILED",
      statusCode: (lastError as any)?.statusCode || 500,
    };
  } catch (outerErr: any) {
    return {
      success: false,
      error: outerErr?.message || "Failed to process scrape request",
      code: outerErr?.code || "UNEXPECTED_ERROR",
      statusCode: outerErr?.statusCode || 500,
    };
  }
}
