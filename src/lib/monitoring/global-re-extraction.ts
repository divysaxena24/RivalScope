import { db } from "@/lib/db";
import {
  competitors,
  trackedUrls,
  scrapeResults,
} from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { executeExtractionForScrape, ExtractionExecutionResult } from "@/lib/ai/extraction/pipeline";

export interface GlobalReExtractionOptions {
  batchSize?: number; // Bounded competitor batch size (default: 5)
  force?: boolean;
}

export interface CompetitorExtractionSummary {
  competitorId: string;
  competitorName: string;
  status: "SUCCESS" | "NO_SCRAPES_FOUND" | "PARTIAL_SUCCESS" | "FAILED";
  urlsProcessed: number;
  totalPlansExtracted: number;
  totalFeaturesExtracted: number;
  errors: string[];
}

export interface GlobalReExtractionResult {
  totalCompetitors: number;
  processedCompetitors: number;
  successfulCompetitors: number;
  failedCompetitors: number;
  totalFeaturesReExtracted: number;
  totalPlansUpdated: number;
  competitorSummaries: CompetitorExtractionSummary[];
}

/**
 * Universal global re-extraction and synchronization service:
 * 1. Universally queries all active competitors dynamically (no hardcoded names).
 * 2. Identifies the latest successful scrape for every active tracked URL.
 * 3. Re-extracts plan-specific features using the rich availability pipeline.
 * 4. Persists immutable historical snapshots and replaces the latest feature state.
 * 5. Isolates failures per competitor so an error on one competitor does not block others.
 */
export async function runGlobalFeatureReExtraction(
  options: GlobalReExtractionOptions = {}
): Promise<GlobalReExtractionResult> {
  const { batchSize = 10, force = true } = options;

  // 1. Discover all active competitors dynamically
  const activeCompetitors = await db.query.competitors.findMany({
    where: eq(competitors.status, "active"),
    with: {
      trackedUrls: {
        where: eq(trackedUrls.isActive, true),
      },
    },
    limit: batchSize,
  });

  const summaries: CompetitorExtractionSummary[] = [];
  let grandTotalFeatures = 0;
  let grandTotalPlans = 0;
  let successfulCompsCount = 0;
  let failedCompsCount = 0;

  for (const comp of activeCompetitors) {
    const compSummary: CompetitorExtractionSummary = {
      competitorId: comp.id,
      competitorName: comp.name,
      status: "SUCCESS",
      urlsProcessed: 0,
      totalPlansExtracted: 0,
      totalFeaturesExtracted: 0,
      errors: [],
    };

    if (comp.trackedUrls.length === 0) {
      compSummary.status = "NO_SCRAPES_FOUND";
      summaries.push(compSummary);
      continue;
    }

    let compHadSuccess = false;
    let compHadFailure = false;

    // Process each active tracked URL of this competitor independently
    for (const tUrl of comp.trackedUrls) {
      try {
        // Find latest successful scrape for this tracked URL
        const latestScrape = await db.query.scrapeResults.findFirst({
          where: and(
            eq(scrapeResults.competitorId, comp.id),
            eq(scrapeResults.trackedUrlId, tUrl.id),
            eq(scrapeResults.status, "SUCCESS")
          ),
          orderBy: [desc(scrapeResults.scrapedAt)],
        });

        if (!latestScrape) {
          compSummary.errors.push(`No successful scrape found for URL: ${tUrl.url}`);
          continue;
        }

        // Execute extraction with full pipeline & change detection
        const extractionOutcome: ExtractionExecutionResult = await executeExtractionForScrape(
          latestScrape.id,
          { force }
        );

        compSummary.urlsProcessed++;
        compSummary.totalPlansExtracted += extractionOutcome.extractedPlanCount;
        compSummary.totalFeaturesExtracted += extractionOutcome.extractedFeatureCount;
        compHadSuccess = true;
      } catch (err: unknown) {
        compHadFailure = true;
        const msg = err instanceof Error ? err.message : String(err);
        compSummary.errors.push(`URL ${tUrl.url} extraction failed: ${msg}`);
      }
    }

    if (compHadFailure && !compHadSuccess) {
      compSummary.status = "FAILED";
      failedCompsCount++;
    } else if (compHadFailure && compHadSuccess) {
      compSummary.status = "PARTIAL_SUCCESS";
      successfulCompsCount++;
    } else if (compHadSuccess) {
      compSummary.status = "SUCCESS";
      successfulCompsCount++;
    } else {
      compSummary.status = "NO_SCRAPES_FOUND";
    }

    grandTotalFeatures += compSummary.totalFeaturesExtracted;
    grandTotalPlans += compSummary.totalPlansExtracted;
    summaries.push(compSummary);
  }

  return {
    totalCompetitors: activeCompetitors.length,
    processedCompetitors: summaries.length,
    successfulCompetitors: successfulCompsCount,
    failedCompetitors: failedCompsCount,
    totalFeaturesReExtracted: grandTotalFeatures,
    totalPlansUpdated: grandTotalPlans,
    competitorSummaries: summaries,
  };
}
