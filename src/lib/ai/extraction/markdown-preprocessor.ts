/**
 * Universal Markdown preprocessor for pricing extraction.
 * Cleans web scraping noise while strictly preserving:
 * - Pricing tables, columns, rows, headers, delimiters
 * - Plan names, prices, currencies, billing frequencies
 * - Features, bullet points, checklists, limitations, and quotas
 * - Footnotes and legal definitions affecting usage limits
 */

/**
 * Preprocesses scraped markdown to remove low-information noise
 * without damaging pricing tables, lists, or structural context.
 */
export function preprocessPricingMarkdown(rawMarkdown: string): string {
  if (!rawMarkdown) return "";

  const lines = rawMarkdown.split("\n");
  const cleanedLines: string[] = [];
  let inCodeBlock = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Toggle code fence tracking
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      cleanedLines.push(line);
      continue;
    }
    if (inCodeBlock) {
      cleanedLines.push(line);
      continue;
    }

    // Markdown table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      cleanedLines.push(line);
      continue;
    } else if (inTable && !trimmed.startsWith("|")) {
      inTable = false;
    }

    // Filter 1: Strip standalone image markup (e.g. ![](https://...svg)) that has no pricing info
    if (/^!\[.*?\]\(.*?\)$/.test(trimmed)) {
      continue;
    }

    // Filter 2: Strip standard noise links / accessibility skip links
    if (
      /\[(?:skip to (?:main )?content|back to top|close|cookie policy|privacy policy|terms of (?:service|use)|manage cookies)\]/i.test(
        trimmed
      )
    ) {
      continue;
    }

    // Filter 3: Strip pure social media / share links
    if (
      /^\[(?:twitter|facebook|linkedin|instagram|youtube|github|discord|reddit)\]/i.test(
        trimmed
      )
    ) {
      continue;
    }

    // Filter 4: Collapse SVG or base64 raw artifacts if present
    if (trimmed.startsWith("data:image/") || trimmed.includes("base64,")) {
      continue;
    }

    // Filter 5: Eliminate repetitive non-pricing navigation bullets (e.g. language pickers)
    if (
      /^\*?\s*\[.*?\]\(.*?\)\s*$/.test(trimmed) &&
      !/(?:pricing|plan|tier|upgrade|free|pro|plus|ultra|team|enterprise|\$|€|£|₹)/i.test(
        trimmed
      ) &&
      (trimmed.includes("select-region") || trimmed.includes("locale") || trimmed.includes("language"))
    ) {
      continue;
    }

    cleanedLines.push(line);
  }

  // Collapse consecutive blank lines (more than 2 -> 2)
  const result: string[] = [];
  let blankCount = 0;
  for (const l of cleanedLines) {
    if (l.trim() === "") {
      blankCount++;
      if (blankCount <= 2) {
        result.push(l);
      }
    } else {
      blankCount = 0;
      result.push(l);
    }
  }

  return result.join("\n").trim();
}
