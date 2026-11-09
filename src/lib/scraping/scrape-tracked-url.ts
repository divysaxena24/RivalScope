import { db, trackedUrls, scrapeResults, competitors } from "@/lib/db";
import { eq } from "drizzle-orm";
import { scrapePage } from "@/lib/firecrawl/scrape";
import { ScrapeTrackedUrlResult } from "./scrape-types";

// In-memory set to prevent simultaneous duplicate scans of the exact same tracked URL
const activeScans = new Set<string>();

/**
 * Scrapes a single tracked URL, persists raw markdown & metadata to scrape_results,
 * and updates the tracked_urls table.
 */
export async function scrapeTrackedUrl(
  trackedUrlId: string
): Promise<ScrapeTrackedUrlResult> {
  if (activeScans.has(trackedUrlId)) {
    throw new Error("A scan is already in progress for this URL.");
  }

  activeScans.add(trackedUrlId);

  try {
    // 1. Fetch tracked URL and ensure it's active
    const tracked = await db.query.trackedUrls.findFirst({
      where: eq(trackedUrls.id, trackedUrlId),
      with: {
        competitor: true,
      },
    });

    if (!tracked) {
      throw new Error(`Tracked URL record not found: ${trackedUrlId}`);
    }

    if (tracked.competitor?.status === "archived") {
      throw new Error(`Cannot scan URL for archived competitor "${tracked.competitor.name}". Restore the competitor first.`);
    }

    if (!tracked.isActive) {
      throw new Error(`Tracked URL is marked as inactive: ${tracked.url}`);
    }

    const now = new Date();

    // 2. Perform Firecrawl scrape
    const scrapeOutcome = await scrapePage(tracked.url);

    if (scrapeOutcome.success) {
      const { markdown, title, metadata, contentHash } = scrapeOutcome.data;

      // 3. Persist success result to scrape_results table
      const [saved] = await db
        .insert(scrapeResults)
        .values({
          competitorId: tracked.competitorId,
          trackedUrlId: tracked.id,
          sourceUrl: tracked.url,
          pageTitle: title,
          markdownContent: markdown,
          metadata,
          contentHash,
          status: "SUCCESS",
          scrapedAt: now,
        })
        .returning();

      // 4. Update tracked_urls table
      await db
        .update(trackedUrls)
        .set({
          lastScannedAt: now,
          lastScanStatus: "SUCCESS",
          updatedAt: now,
        })
        .where(eq(trackedUrls.id, tracked.id));

      return {
        trackedUrlId: tracked.id,
        url: tracked.url,
        status: "SUCCESS",
        scrapeResultId: saved.id,
        contentHash,
        pageTitle: title,
        scrapedAt: now.toISOString(),
      };
    } else {
      // Scrape failed
      const [saved] = await db
        .insert(scrapeResults)
        .values({
          competitorId: tracked.competitorId,
          trackedUrlId: tracked.id,
          sourceUrl: tracked.url,
          pageTitle: null,
          markdownContent: "",
          metadata: {},
          contentHash: "",
          status: "FAILED",
          errorMessage: scrapeOutcome.error,
          scrapedAt: now,
        })
        .returning();

      // Update tracked_urls table with error status (do not alter/delete existing plans or snapshots)
      await db
        .update(trackedUrls)
        .set({
          lastScannedAt: now,
          lastScanStatus: "FAILED",
          updatedAt: now,
        })
        .where(eq(trackedUrls.id, tracked.id));

      return {
        trackedUrlId: tracked.id,
        url: tracked.url,
        status: "FAILED",
        scrapeResultId: saved.id,
        errorMessage: scrapeOutcome.error,
        scrapedAt: now.toISOString(),
      };
    }
  } finally {
    activeScans.delete(trackedUrlId);
  }
}
