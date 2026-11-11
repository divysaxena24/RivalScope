import { scrapeCompetitor } from "@/lib/scraping/scrape-competitor";
import { executeExtractionForScrape } from "@/lib/ai/extraction/pipeline";
import { db } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { scrapeResults } from "@/lib/db/schema";

/**
 * Executes a full pipeline run:
 * Crawls all active competitor URLs via Firecrawl, then extracts structured pricing via Groq LLM.
 */
export async function runScrapeAndExtractPipeline(competitorId: string) {
  // 1. Scrape competitor
  const scrapeSummary = await scrapeCompetitor(competitorId);

  // 2. Identify newly successful scrapes
  const successfulScrapeIds = scrapeSummary.results
    .filter((r) => r.status === "SUCCESS" && r.scrapeResultId)
    .map((r) => r.scrapeResultId as string);

  const extractionOutcomes = [];

  // 3. Run Groq extraction for each successful scrape
  for (const sId of successfulScrapeIds) {
    try {
      const outcome = await executeExtractionForScrape(sId);
      extractionOutcomes.push(outcome);
    } catch (err: unknown) {
      extractionOutcomes.push({
        scrapeId: sId,
        competitorId,
        status: "FAILED" as const,
        extractedPlanCount: 0,
        extractedFeatureCount: 0,
        detectedChangesCount: 0,
        counts: {
          modelExtracted: 0,
          validated: 0,
          distinctOfferings: 0,
          persisted: 0,
          skipped: 0,
        },
        errorMessage: err instanceof Error ? err.message : "Extraction failed",
        plans: [],
      });
    }
  }

  return {
    competitorId,
    scrapeSummary,
    extractionOutcomes,
  };
}
