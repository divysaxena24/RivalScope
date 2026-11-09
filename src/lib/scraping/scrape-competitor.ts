import { db, competitors, trackedUrls } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { scrapeTrackedUrl } from "./scrape-tracked-url";
import { ScrapeCompetitorSummary, ScrapeTrackedUrlResult } from "./scrape-types";

/**
 * Scrapes all active tracked URLs for a competitor with controlled concurrency (e.g., 2 at a time).
 */
export async function scrapeCompetitor(
  competitorId: string,
  concurrency = 2
): Promise<ScrapeCompetitorSummary> {
  const competitor = await db.query.competitors.findFirst({
    where: eq(competitors.id, competitorId),
    with: {
      trackedUrls: {
        where: eq(trackedUrls.isActive, true),
      },
    },
  });

  if (!competitor) {
    throw new Error(`Competitor not found: ${competitorId}`);
  }

  if (competitor.status === "archived") {
    throw new Error(`Cannot scan archived competitor "${competitor.name}". Restore the competitor first.`);
  }

  const urlsToScrape = competitor.trackedUrls;
  const results: ScrapeTrackedUrlResult[] = [];

  // Controlled concurrency queue
  const queue = [...urlsToScrape];
  const workers = Array.from(
    { length: Math.min(concurrency, queue.length || 1) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        try {
          const outcome = await scrapeTrackedUrl(item.id);
          results.push(outcome);
        } catch (err: unknown) {
          results.push({
            trackedUrlId: item.id,
            url: item.url,
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : "Scraping failed",
            scrapedAt: new Date().toISOString(),
          });
        }
      }
    }
  );

  await Promise.all(workers);

  const successfulScrapes = results.filter((r) => r.status === "SUCCESS").length;
  const failedScrapes = results.filter((r) => r.status === "FAILED").length;

  return {
    competitorId: competitor.id,
    competitorName: competitor.name,
    totalUrls: urlsToScrape.length,
    successfulScrapes,
    failedScrapes,
    results,
  };
}
