import {
  PreprocessedMarkdownResult,
  PreprocessingMetrics,
  PricingSection,
  ExtractedTable,
} from "./types";
import { extractMarkdownTables } from "./table-extractor";
import {
  extractCandidatePrices,
  extractCandidatePlanNames,
} from "./pricing-section-detector";
import { isNoiseHeading, filterLineNoise } from "./relevance-filter";
import { estimateTokens } from "../extraction/token-budget";

/**
 * Universal Pre-Extraction Preprocessing Engine.
 * Segments Markdown by structural headings, filters out non-pricing noise,
 * preserves 100% of tables and plan entitlement cards, and provides comprehensive
 * metrics and safety quality guards.
 */
export function preprocessMarkdownForExtraction(rawMarkdown: string): PreprocessedMarkdownResult {
  const rawCharacterCount = (rawMarkdown || "").length;
  const rawEstimatedTokens = estimateTokens(rawMarkdown || "");

  if (!rawMarkdown || rawMarkdown.trim().length < 20) {
    return {
      preprocessedMarkdown: rawMarkdown || "",
      metrics: {
        rawCharacterCount,
        preprocessedCharacterCount: rawCharacterCount,
        reductionPercentage: 0,
        rawEstimatedTokens,
        preprocessedEstimatedTokens: rawEstimatedTokens,
        totalSectionsFound: 0,
        relevantSectionsRetained: 0,
        tablesFound: 0,
        tablesPreserved: 0,
        candidatePricesFound: 0,
        candidatePlansFound: [],
        usedFallback: false,
      },
      sections: [],
      preservedTables: [],
      status: "NO_PRICING_CONTENT",
    };
  }

  // 1. Line-level initial noise cleaning
  const rawLines = rawMarkdown.split("\n");
  const cleanedLines: string[] = [];
  let inCodeBlock = false;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      cleanedLines.push(line);
      continue;
    }
    if (inCodeBlock) {
      cleanedLines.push(line);
      continue;
    }
    if (filterLineNoise(line)) {
      cleanedLines.push(line);
    }
  }

  // 2. Identify sections along Markdown heading boundaries (#, ##, ###, ####)
  const sections: PricingSection[] = [];
  let currentHeading = "Overview";
  let currentLevel = 1;
  let currentSectionLines: string[] = [];
  let inTable = false;

  const pushSection = () => {
    if (currentSectionLines.length === 0) return;
    const content = currentSectionLines.join("\n").trim();
    if (!content) return;

    const tables = extractMarkdownTables(content);
    const planCandidates = extractCandidatePlanNames(content);
    const priceCandidates = extractCandidatePrices(content);

    // Score relevance
    const hasTable = tables.length > 0;
    const isPricingCard = planCandidates.length > 0 || priceCandidates.length > 0;
    const isRelevantKeyword =
      /(?:pricing|tier|plan|subscription|included|unlimited|per user|per month|billing|features|limits|quota|free|pro|plus|ultra|team|enterprise)/i.test(
        currentHeading + " " + content
      );

    let relevanceScore = 0;
    if (hasTable) relevanceScore += 0.5;
    if (isPricingCard) relevanceScore += 0.4;
    if (isRelevantKeyword) relevanceScore += 0.3;
    if (priceCandidates.length > 0) relevanceScore += 0.5;

    sections.push({
      heading: currentHeading,
      level: currentLevel,
      content,
      tokensEstimated: estimateTokens(content),
      relevanceScore,
      hasTable,
      isPricingCard,
      tables,
      planCandidates,
      priceCandidates,
    });

    currentSectionLines = [];
  };

  for (let i = 0; i < cleanedLines.length; i++) {
    const line = cleanedLines[i];
    const trimmed = line.trim();
    const isTableRow = /^\|.*\|$/.test(trimmed);

    if (isTableRow) {
      inTable = true;
    } else if (inTable && !isTableRow) {
      inTable = false;
    }

    const headingMatch = !inTable ? trimmed.match(/^(#{1,4})\s+(.+)$/) : null;

    if (headingMatch) {
      pushSection();
      currentLevel = headingMatch[1].length;
      currentHeading = headingMatch[2].trim();
      currentSectionLines = [line];
    } else {
      currentSectionLines.push(line);
    }
  }
  pushSection();

  // 3. Section Relevance Filtering
  // Retain sections that contain pricing tables, plans, pricing numbers, or relevant keywords
  const allTablesFound = sections.reduce((acc, s) => acc + s.tables.length, 0);
  const allCandidatePrices = sections.reduce((acc, s) => acc + s.priceCandidates.length, 0);
  const allCandidatePlans = Array.from(new Set(sections.flatMap((s) => s.planCandidates)));

  const retainedSections: PricingSection[] = [];
  const preservedTables: ExtractedTable[] = [];

  for (const sec of sections) {
    if (isNoiseHeading(sec.heading)) {
      continue;
    }

    // Always retain if it has a table, price candidates, plan candidates, or positive relevance
    if (
      sec.hasTable ||
      sec.isPricingCard ||
      sec.priceCandidates.length > 0 ||
      sec.planCandidates.length > 0 ||
      sec.relevanceScore > 0.2
    ) {
      retainedSections.push(sec);
      preservedTables.push(...sec.tables);
    } else if (sections.length <= 2) {
      // If the document is small with minimal structure, retain everything
      retainedSections.push(sec);
      preservedTables.push(...sec.tables);
    }
  }

  // 4. Quality Guard & Fallback Protection:
  // If the preprocessor filtered out everything, or if significant pricing candidates
  // were found originally but dropped by filtering, fall back to the safe cleaned Markdown.
  let preprocessedMarkdown: string;
  let usedFallback = false;
  let fallbackReason: string | undefined;

  const retainedCandidatePrices = retainedSections.reduce((acc, s) => acc + s.priceCandidates.length, 0);

  if (retainedSections.length === 0 && sections.length > 0) {
    usedFallback = true;
    fallbackReason = "Relevance filter produced empty sections; falling back to full cleaned content.";
    preprocessedMarkdown = cleanedLines.join("\n");
  } else if (allCandidatePrices > 0 && retainedCandidatePrices === 0) {
    usedFallback = true;
    fallbackReason = "Candidate prices were lost during section filtering; activating fallback to prevent data loss.";
    preprocessedMarkdown = cleanedLines.join("\n");
  } else {
    // Reconstruct preprocessed markdown with section headings
    preprocessedMarkdown = retainedSections.map((s) => s.content).join("\n\n");
  }

  const preprocessedCharacterCount = preprocessedMarkdown.length;
  const preprocessedEstimatedTokens = estimateTokens(preprocessedMarkdown);
  const reductionPercentage = rawCharacterCount > 0
    ? Math.max(0, Math.round(((rawCharacterCount - preprocessedCharacterCount) / rawCharacterCount) * 100))
    : 0;

  const metrics: PreprocessingMetrics = {
    rawCharacterCount,
    preprocessedCharacterCount,
    reductionPercentage,
    rawEstimatedTokens,
    preprocessedEstimatedTokens,
    totalSectionsFound: sections.length,
    relevantSectionsRetained: retainedSections.length,
    tablesFound: allTablesFound,
    tablesPreserved: preservedTables.length,
    candidatePricesFound: allCandidatePrices,
    candidatePlansFound: allCandidatePlans,
    usedFallback,
    fallbackReason,
  };

  const status: "OPTIMIZED" | "FALLBACK" | "NO_PRICING_CONTENT" =
    usedFallback
      ? "FALLBACK"
      : allCandidatePrices === 0 && allTablesFound === 0 && allCandidatePlans.length === 0
      ? "NO_PRICING_CONTENT"
      : "OPTIMIZED";

  return {
    preprocessedMarkdown,
    metrics,
    sections: retainedSections,
    preservedTables,
    status,
    qualityWarning: fallbackReason,
  };
}

