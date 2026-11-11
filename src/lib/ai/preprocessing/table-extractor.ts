import { ExtractedTable } from "./types";

/**
 * Universal Markdown table extractor.
 * Extracts Markdown tables, validates headers/rows, and detects whether
 * a table contains pricing plans, tiers, or feature comparison matrices.
 */
export function extractMarkdownTables(markdown: string): ExtractedTable[] {
  const lines = markdown.split("\n");
  const tables: ExtractedTable[] = [];

  let inTable = false;
  let currentTableLines: string[] = [];

  const finishTable = () => {
    if (currentTableLines.length < 2) {
      currentTableLines = [];
      inTable = false;
      return;
    }

    const tableObj = parseTableBlock(currentTableLines);
    if (tableObj) {
      tables.push(tableObj);
    }
    currentTableLines = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line is a table row (starts and ends with |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      currentTableLines.push(trimmed);
    } else {
      if (inTable) {
        finishTable();
      }
    }
  }

  if (inTable) {
    finishTable();
  }

  return tables;
}

/**
 * Parses raw table lines into structured ExtractedTable
 */
function parseTableBlock(lines: string[]): ExtractedTable | null {
  if (lines.length < 2) return null;

  const rawMarkdown = lines.join("\n");
  const splitCells = (row: string) => {
    const inner = row.slice(1, -1);
    return inner.split("|").map((c) => c.trim());
  };

  const headerRow = splitCells(lines[0]);
  let dataStartIndex = 1;

  // Check if line 1 is divider row (e.g. |---|---|)
  if (lines.length > 1 && /^[|\s-:]+$/.test(lines[1])) {
    dataStartIndex = 2;
  }

  const rows: string[][] = [];
  for (let i = dataStartIndex; i < lines.length; i++) {
    rows.push(splitCells(lines[i]));
  }

  // Detect if this table is pricing or feature related
  const tableText = rawMarkdown.toLowerCase();
  const pricingKeywords = [
    "price",
    "pricing",
    "tier",
    "plan",
    "monthly",
    "annual",
    "yearly",
    "per user",
    "per seat",
    "per month",
    "feature",
    "included",
    "unlimited",
    "free",
    "pro",
    "plus",
    "ultra",
    "team",
    "enterprise",
    "token",
    "credit",
    "limit",
    "quota",
    "api",
    "support",
    "$",
    "€",
    "£",
    "₹",
  ];

  let keywordHits = 0;
  for (const kw of pricingKeywords) {
    if (tableText.includes(kw)) {
      keywordHits++;
    }
  }

  // Also check for yes/no/check matrix cells
  const hasMatrixValues =
    /\b(yes|no|check|included|excluded|available|limited|\u2713|\u2714|\u2715|\u2716|—|-)\b/i.test(
      tableText
    );

  const isPricingOrFeatureTable =
    keywordHits >= 2 || (keywordHits >= 1 && hasMatrixValues) || rows.length >= 3;

  const confidenceScore = Math.min(
    1,
    (keywordHits * 0.15) + (hasMatrixValues ? 0.3 : 0) + (headerRow.length >= 2 ? 0.2 : 0)
  );

  return {
    headers: headerRow,
    rows,
    rawMarkdown,
    isPricingOrFeatureTable,
    columnCount: headerRow.length,
    rowCount: rows.length,
    confidenceScore,
  };
}

