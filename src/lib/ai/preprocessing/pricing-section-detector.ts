import { CandidatePrice } from "./types";

/**
 * Universal regex patterns for currency and pricing detection across global SaaS pages
 */
const CURRENCY_SYMBOLS = /[$€£₹¥A\$C\$]/;
const PRICE_NUMBERS = /(?:[$€£₹¥]\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:USD|EUR|GBP|INR|CAD|AUD))/i;
const BILLING_PERIOD_PATTERN = /(?:per\s+(?:month|user|seat|year)|(?:[\/]\s*(?:mo|month|yr|year|user|seat))|\bmonthly\b|\bannually\b|\byearly\b|\bbilled\s+annually\b|\bbilled\s+monthly\b)/i;

/**
 * Extracts candidate prices from a given block of text.
 */
export function extractCandidatePrices(text: string): CandidatePrice[] {
  const candidates: CandidatePrice[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Free indicators
    if (/\b(free|forever free|\$0(?:\/mo)?|0\/month|0\s*usd)\b/i.test(trimmed)) {
      candidates.push({
        raw: trimmed,
        amount: 0,
        currencySymbol: trimmed.includes("$") ? "$" : null,
        period: "monthly",
        isFree: true,
        isCustom: false,
      });
      continue;
    }

    // Custom / Contact sales indicators
    if (/\b(contact sales|contact us|custom quote|let'?s talk|enterprise pricing)\b/i.test(trimmed)) {
      candidates.push({
        raw: trimmed,
        amount: null,
        currencySymbol: null,
        period: "custom",
        isFree: false,
        isCustom: true,
      });
      continue;
    }

    // Explicit price numbers with currency
    const match = trimmed.match(PRICE_NUMBERS);
    if (match) {
      const numStr = match[1] || match[2];
      const parsedNum = parseFloat(numStr.replace(",", "."));
      const symbolMatch = trimmed.match(CURRENCY_SYMBOLS);
      const periodMatch = trimmed.match(BILLING_PERIOD_PATTERN);

      candidates.push({
        raw: trimmed,
        amount: isNaN(parsedNum) ? null : parsedNum,
        currencySymbol: symbolMatch ? symbolMatch[0] : null,
        period: periodMatch ? periodMatch[0].toLowerCase() : null,
        isFree: parsedNum === 0,
        isCustom: false,
      });
    }
  }

  return candidates;
}

/**
 * Extracts potential plan names from headings or pricing card labels.
 */
export function extractCandidatePlanNames(text: string): string[] {
  const planNames = new Set<string>();
  const lines = text.split("\n");

  const commonPlanTokens = [
    "free",
    "starter",
    "standard",
    "basic",
    "pro",
    "professional",
    "pro+",
    "plus",
    "max",
    "ultra",
    "team",
    "teams",
    "business",
    "enterprise",
    "growth",
    "scale",
    "developer",
    "individual",
    "commercial",
    "personal",
    "family",
    "unlimited",
    "premium",
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    // Headings: ### Free, ## Pro, ### Pro+, # Enterprise, ### Copilot for Microsoft 365 Business
    const headingMatch = trimmed.match(/^#{1,4}\s+([A-Za-z0-9+.\- ]{2,50})$/);
    if (headingMatch) {
      const title = headingMatch[1].trim();
      const lower = title.toLowerCase();

      // Check if heading matches or contains common plan keywords or ends with Plan/Tier/Edition
      const isKnownPlanToken = commonPlanTokens.some(
        (token) =>
          lower === token ||
          lower.startsWith(token + " ") ||
          lower.endsWith(" " + token) ||
          lower.includes(" " + token + " ") ||
          lower.includes(" " + token)
      );
      const hasPlanSuffix = /(?:plan|tier|edition|package)$/i.test(title);

      if (isKnownPlanToken || hasPlanSuffix) {
        planNames.add(title);
      }
    }
  }

  return Array.from(planNames);
}
