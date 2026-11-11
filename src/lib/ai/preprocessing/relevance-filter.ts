/**
 * Relevance filter for stripping low-information web scrapings noise
 * while strictly preserving:
 * - Pricing tables, columns, rows, headers
 * - Plan cards, headings, price amounts, billing frequencies
 * - Entitlements, bullet points, limitations, usage quotas, footnoted credits
 */

/**
 * Standard patterns of pure noise sections that never contain pricing offerings or limits.
 */
const NOISE_HEADING_PATTERNS = [
  /^(?:privacy|terms of service|terms of use|cookie policy|legal notices|security whitepaper)$/i,
  /^(?:subscribe to newsletter|join our mailing list|stay updated)$/i,
  /^(?:follow us|social links|connect with us)$/i,
  /^(?:careers|job openings|we are hiring|investor relations|press releases)$/i,
  /^(?:about us|leadership|company history)$/i,
];

/**
 * Determines whether a given section heading is safe to filter out.
 */
export function isNoiseHeading(heading: string): boolean {
  const clean = heading.trim().toLowerCase();
  return NOISE_HEADING_PATTERNS.some((p) => p.test(clean));
}

/**
 * Filters out low-value lines (boilerplate cookies, session alerts, raw SVGs, social buttons)
 */
export function filterLineNoise(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true; // keep blank line structure

  // 1. Accessibility skip links
  if (/\[(?:skip to (?:main )?content|back to top|close|cookie policy|privacy policy)\]/i.test(trimmed)) {
    return false;
  }

  // 2. Pure social links
  if (/^\[(?:twitter|facebook|linkedin|instagram|youtube|github|discord|reddit)\]/i.test(trimmed)) {
    return false;
  }

  // 3. Raw SVG/Base64 data URIs
  if (trimmed.startsWith("data:image/") || trimmed.includes("base64,")) {
    return false;
  }

  // 4. Repetitive language/locale pickers with no pricing context
  if (
    /^\*?\s*\[.*?\]\(.*?\)\s*$/.test(trimmed) &&
    !/(?:pricing|plan|tier|upgrade|free|pro|plus|ultra|team|enterprise|\$|€|£|₹)/i.test(trimmed) &&
    (trimmed.includes("select-region") || trimmed.includes("locale") || trimmed.includes("language"))
  ) {
    return false;
  }

  // 5. Browser session alerts
  if (
    trimmed.includes("You signed in with another tab") ||
    trimmed.includes("You signed out in another tab") ||
    trimmed.includes("You switched accounts on another tab") ||
    trimmed === "Dismiss alert" ||
    trimmed === "{{ message }}"
  ) {
    return false;
  }

  // 6. Generic decorative image markup
  if (/^!\[.*?\]\(.*?\)$/.test(trimmed) && !/(?:pricing|tier|plan|table|feature)/i.test(trimmed)) {
    return false;
  }

  return true;
}

