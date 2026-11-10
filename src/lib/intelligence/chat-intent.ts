/**
 * Chat query intent classification and safe error normalization
 * for RivalScope Competitor Intelligence Assistant.
 */

export type ChatIntentClassification =
  | { inScope: true }
  | { inScope: false; reason: string };

export const OUT_OF_SCOPE_FRIENDLY_MESSAGE =
  "I'm designed to help with competitive intelligence, including competitor pricing, features, product comparisons, market positioning, and historical changes. This question is outside my scope. Try asking me something about your selected competitor!";

export const INSUFFICIENT_DATA_FRIENDLY_MESSAGE =
  "I couldn't find enough information in the available competitor data to answer this reliably. Try refreshing the competitor's tracked pages or asking about information currently available in its profile.";

/**
 * High-precision scope checking for user queries.
 * Distinguishes general knowledge, geography, unrelated creative writing, and coding
 * from competitive intelligence queries (pricing, plans, comparison, features, strategy).
 */
export function classifyQueryScope(
  query: string,
  competitorNames: string[] = []
): ChatIntentClassification {
  const q = query.trim().toLowerCase();

  if (!q) {
    return { inScope: false, reason: "EMPTY_QUERY" };
  }

  // 1. Direct competitor mention overrides general patterns
  const mentionsCompetitor = competitorNames.some((name) => {
    const n = name.trim().toLowerCase();
    return n.length > 1 && q.includes(n);
  });

  if (mentionsCompetitor) {
    return { inScope: true };
  }

  // 2. Clear out-of-scope patterns (general knowledge, world trivia, unrelated geography, creative writing, unrelated coding)
  const outOfScopePatterns: RegExp[] = [
    // Politics & world leaders
    /\b(prime minister|president|king|queen|chief minister|parliament|governor|senator|congressman|election|politician)\b/i,
    // Geography trivia / capitals / countries / locations not tied to competitor regions
    /\b(capital of|where is (the )?(kashmir|japan|france|germany|usa|india|china|russia|brazil|egypt|london|paris|tokyo|delhi|mumbai|berlin)|weather in|population of)\b/i,
    // Creative writing & unrelated literature
    /\b(write (me )?(a )?(poem|song|haiku|story|novel|joke|riddle|script|essay on my summer vacation))\b/i,
    // Unrelated general coding puzzles / math problems
    /\b(solve this (coding|math|physics|chemistry) problem|reverse a linked list|binary search algorithm|bubble sort in c|fibonacci series in python|two sum problem)\b/i,
    // General trivia / science
    /\b(distance to (moon|sun|mars)|speed of light|boiling point of|who invented (telephone|light bulb|wheel|car))\b/i,
  ];

  for (const pattern of outOfScopePatterns) {
    if (pattern.test(q)) {
      return { inScope: false, reason: "OUT_OF_SCOPE" };
    }
  }

  // 3. Competitive intelligence domain indicators
  const inScopeKeywords = [
    "price",
    "pricing",
    "plan",
    "plans",
    "cost",
    "tier",
    "subscription",
    "billing",
    "annual",
    "monthly",
    "discount",
    "free",
    "pro",
    "enterprise",
    "plus",
    "ultra",
    "feature",
    "features",
    "compare",
    "comparison",
    "difference",
    "vs",
    "versus",
    "limit",
    "limits",
    "quota",
    "rate limit",
    "competitor",
    "competitors",
    "alternative",
    "alternatives",
    "strength",
    "strengths",
    "weakness",
    "weaknesses",
    "opportunity",
    "opportunities",
    "threat",
    "threats",
    "swot",
    "strategy",
    "positioning",
    "market",
    "trend",
    "trends",
    "change",
    "changes",
    "update",
    "updated",
    "history",
    "increase",
    "decrease",
    "offering",
    "entitlement",
    "package",
    "packaging",
  ];

  const hasInScopeKeyword = inScopeKeywords.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    return regex.test(q);
  });

  if (hasInScopeKeyword) {
    return { inScope: true };
  }

  // 4. Inquire about current selection (e.g. "what do they offer?", "summarize them", "which is better?")
  const relativeCompetitivePhrases = [
    /what do they offer/i,
    /which one is/i,
    /summarize/i,
    /overview/i,
    /recommend/i,
    /best option/i,
    /cheapest/i,
    /most expensive/i,
    /worth it/i,
    /value for money/i,
  ];

  if (relativeCompetitivePhrases.some((p) => p.test(q))) {
    return { inScope: true };
  }

  // If none matched, check if it's very short general conversation (e.g., "hello", "hi")
  const conversationalGreetings = /^(hi|hello|hey|greetings|help|who are you|what can you do)\b/i;
  if (conversationalGreetings.test(q)) {
    return { inScope: true };
  }

  // Otherwise, default out-of-scope for unrelated inquiries
  return { inScope: false, reason: "OUT_OF_SCOPE" };
}

export type ChatErrorCode =
  | "OUT_OF_SCOPE"
  | "INSUFFICIENT_DATA"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "DATABASE_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export interface NormalizedChatError {
  code: ChatErrorCode;
  friendlyMessage: string;
  statusCode: number;
}

/**
 * Safely normalizes any error (Error instance, object, string, null/undefined)
 * into a user-friendly, non-technical explanation and prevents [object Object] leaks.
 */
export function normalizeChatError(error: unknown): NormalizedChatError {
  if (!error) {
    return {
      code: "UNKNOWN_ERROR",
      friendlyMessage: "An unexpected issue occurred. Please try asking your question again.",
      statusCode: 500,
    };
  }

  // Extract raw error text for categorization without exposing to user
  let rawMsg = "";
  let status = 500;

  if (error instanceof Error) {
    rawMsg = error.message;
  } else if (typeof error === "string") {
    rawMsg = error;
  } else if (typeof error === "object") {
    try {
      const errObj = error as Record<string, unknown>;
      rawMsg =
        typeof errObj.message === "string"
          ? errObj.message
          : typeof errObj.error === "string"
          ? errObj.error
          : typeof errObj.details === "string"
          ? errObj.details
          : JSON.stringify(error);
      if (typeof errObj.status === "number") {
        status = errObj.status;
      }
    } catch {
      rawMsg = "Unserializable object error";
    }
  }

  const lower = rawMsg.toLowerCase();

  // Rate Limiting (Groq 429 / TPU rate limits)
  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("tokens per minute") ||
    lower.includes("tpm") ||
    lower.includes("too many requests")
  ) {
    return {
      code: "RATE_LIMITED",
      friendlyMessage:
        "The intelligence assistant is currently experiencing high demand. Please wait a few seconds and try your request again.",
      statusCode: 429,
    };
  }

  // Database Connection / Neon Errors
  if (
    lower.includes("neon") ||
    lower.includes("postgres") ||
    lower.includes("database") ||
    lower.includes("connection terminated") ||
    lower.includes("fetch failed") && lower.includes("drizzle")
  ) {
    return {
      code: "DATABASE_ERROR",
      friendlyMessage:
        "We encountered a temporary issue accessing your competitive data records. Please try again in a moment.",
      statusCode: 503,
    };
  }

  // Network / Offline Errors
  if (
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("timeout")
  ) {
    return {
      code: "NETWORK_ERROR",
      friendlyMessage:
        "Unable to establish a connection with the intelligence service. Please verify your internet connection and try again.",
      statusCode: 504,
    };
  }

  // Provider / Groq Model API Errors
  if (
    lower.includes("groq") ||
    lower.includes("model_error") ||
    lower.includes("internal_server_error") ||
    lower.includes("bad gateway") ||
    lower.includes("502") ||
    lower.includes("503")
  ) {
    return {
      code: "PROVIDER_ERROR",
      friendlyMessage:
        "The AI reasoning provider is temporarily unavailable. We are automatically retrying, but feel free to retry shortly.",
      statusCode: 502,
    };
  }

  // Default clean fallback
  return {
    code: "UNKNOWN_ERROR",
    friendlyMessage:
      "We were unable to complete your analysis right now. Please try asking again or scope your question to a specific competitor.",
    statusCode: status >= 400 && status < 600 ? status : 500,
  };
}
