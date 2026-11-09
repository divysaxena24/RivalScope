import { estimateTokens, ModelTokenBudget } from "./token-budget";

export interface MarkdownChunk {
  chunkIndex: number;
  totalChunks: number;
  title: string;
  content: string;
  estimatedTokens: number;
}

/**
 * Splits markdown documents into semantic, token-budgeted chunks.
 * Ensures:
 * 1. Markdown tables and their headers are kept intact.
 * 2. Plan sections under headers (#, ##, ###) stay together.
 * 3. Never splits a single table across chunks if it fits within the chunk budget.
 * 4. Preserves overlapping context or clear section boundaries.
 */
export function chunkMarkdownForExtraction(
  markdown: string,
  budget: ModelTokenBudget
): MarkdownChunk[] {
  const totalTokens = estimateTokens(markdown);

  // If document fits comfortably inside one pass budget, return single chunk
  if (totalTokens <= budget.maxChunkInputTokens) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        title: "Full Document",
        content: markdown,
        estimatedTokens: totalTokens,
      },
    ];
  }

  // Document exceeds budget: split along semantic boundaries (headings, horizontal rules, table blocks)
  const lines = markdown.split("\n");
  const sections: Array<{ heading: string; lines: string[]; tokens: number }> = [];

  let currentHeading = "Overview";
  let currentLines: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = /^#{1,4}\s+/.test(line.trim());
    const isTableRow = /^\|.*\|$/.test(line.trim());

    if (isTableRow) {
      inTable = true;
    } else if (inTable && !isTableRow) {
      inTable = false;
    }

    // Split at major heading boundary if not inside a table
    if (isHeading && !inTable && currentLines.length > 0) {
      const sectionText = currentLines.join("\n");
      sections.push({
        heading: currentHeading,
        lines: currentLines,
        tokens: estimateTokens(sectionText),
      });
      currentHeading = line.trim().replace(/^#{1,4}\s+/, "");
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const sectionText = currentLines.join("\n");
    sections.push({
      heading: currentHeading,
      lines: currentLines,
      tokens: estimateTokens(sectionText),
    });
  }

  // Group sections into bounded chunks respecting maxChunkInputTokens
  const chunks: MarkdownChunk[] = [];
  let currentChunkLines: string[] = [];
  let currentChunkTokens = 0;
  let currentChunkTitles: string[] = [];

  for (const sec of sections) {
    // If a single section is itself massive (e.g. an enormous 100-row feature table),
    // slice that section by row groups
    if (sec.tokens > budget.maxChunkInputTokens) {
      // First flush any accumulated chunk lines
      if (currentChunkLines.length > 0) {
        chunks.push({
          chunkIndex: chunks.length,
          totalChunks: 0, // will set later
          title: currentChunkTitles.join(" / ") || "Pricing Section",
          content: currentChunkLines.join("\n"),
          estimatedTokens: currentChunkTokens,
        });
        currentChunkLines = [];
        currentChunkTokens = 0;
        currentChunkTitles = [];
      }

      // Slice the oversized section line by line
      let subLines: string[] = [];
      let subTokens = 0;
      let tableHeaderRow: string | null = null;
      let tableDividerRow: string | null = null;

      for (const line of sec.lines) {
        if (/^\|.*\|$/.test(line.trim())) {
          if (!tableHeaderRow) {
            tableHeaderRow = line;
          } else if (!tableDividerRow && line.includes("---")) {
            tableDividerRow = line;
          }
        }

        const lineTokens = estimateTokens(line);
        if (subTokens + lineTokens > budget.maxChunkInputTokens && subLines.length > 0) {
          chunks.push({
            chunkIndex: chunks.length,
            totalChunks: 0,
            title: `${sec.heading} (Part ${chunks.length + 1})`,
            content: subLines.join("\n"),
            estimatedTokens: subTokens,
          });
          // Preserve table header row for subsequent chunks if inside table
          subLines = tableHeaderRow && tableDividerRow ? [tableHeaderRow, tableDividerRow, line] : [line];
          subTokens = estimateTokens(subLines.join("\n"));
        } else {
          subLines.push(line);
          subTokens += lineTokens;
        }
      }

      if (subLines.length > 0) {
        chunks.push({
          chunkIndex: chunks.length,
          totalChunks: 0,
          title: `${sec.heading} (Part ${chunks.length + 1})`,
          content: subLines.join("\n"),
          estimatedTokens: subTokens,
        });
      }
      continue;
    }

    if (currentChunkTokens + sec.tokens > budget.maxChunkInputTokens && currentChunkLines.length > 0) {
      chunks.push({
        chunkIndex: chunks.length,
        totalChunks: 0,
        title: currentChunkTitles.join(" / ") || "Pricing Section",
        content: currentChunkLines.join("\n"),
        estimatedTokens: currentChunkTokens,
      });
      currentChunkLines = [...sec.lines];
      currentChunkTokens = sec.tokens;
      currentChunkTitles = [sec.heading];
    } else {
      currentChunkLines.push(...sec.lines);
      currentChunkTokens += sec.tokens;
      currentChunkTitles.push(sec.heading);
    }
  }

  if (currentChunkLines.length > 0) {
    chunks.push({
      chunkIndex: chunks.length,
      totalChunks: 0,
      title: currentChunkTitles.join(" / ") || "Pricing Section",
      content: currentChunkLines.join("\n"),
      estimatedTokens: currentChunkTokens,
    });
  }

  // Update totalChunks on all chunks
  return chunks.map((c, idx) => ({
    ...c,
    chunkIndex: idx,
    totalChunks: chunks.length,
  }));
}
