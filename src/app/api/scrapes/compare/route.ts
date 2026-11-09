import { NextRequest } from "next/server";
import { db, scrapeResults } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { uuidSchema } from "@/schemas/api";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { z } from "zod";

const compareQuerySchema = z.object({
  baseId: z.string().uuid("Invalid baseId format"),
  compareId: z.string().uuid("Invalid compareId format"),
});

/**
 * GET /api/scrapes/compare?baseId=...&compareId=...
 * Compares two scrape observations: metadata, timestamps, hash difference, and markdown diff summary.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = compareQuerySchema.safeParse({
      baseId: searchParams.get("baseId"),
      compareId: searchParams.get("compareId"),
    });

    if (!parsed.success) {
      return errorResponse("Invalid baseId or compareId provided", 400);
    }

    const { baseId, compareId } = parsed.data;

    const [baseScrape, compareScrape] = await Promise.all([
      db.query.scrapeResults.findFirst({
        where: eq(scrapeResults.id, baseId),
        with: { competitor: true, trackedUrl: true },
      }),
      db.query.scrapeResults.findFirst({
        where: eq(scrapeResults.id, compareId),
        with: { competitor: true, trackedUrl: true },
      }),
    ]);

    if (!baseScrape || !compareScrape) {
      return errorResponse("One or both scrape observations were not found", 404);
    }

    // Determine chronologically older vs newer
    const isBaseOlder = new Date(baseScrape.scrapedAt).getTime() <= new Date(compareScrape.scrapedAt).getTime();
    const older = isBaseOlder ? baseScrape : compareScrape;
    const newer = isBaseOlder ? compareScrape : baseScrape;

    const contentChanged = older.contentHash !== newer.contentHash;

    const olderLines = older.markdownContent.split("\n");
    const newerLines = newer.markdownContent.split("\n");

    return successResponse({
      contentChanged,
      older: {
        id: older.id,
        scrapedAt: older.scrapedAt,
        contentHash: older.contentHash,
        sourceUrl: older.sourceUrl,
        pageTitle: older.pageTitle,
        status: older.status,
        lineCount: olderLines.length,
        charCount: older.markdownContent.length,
      },
      newer: {
        id: newer.id,
        scrapedAt: newer.scrapedAt,
        contentHash: newer.contentHash,
        sourceUrl: newer.sourceUrl,
        pageTitle: newer.pageTitle,
        status: newer.status,
        lineCount: newerLines.length,
        charCount: newer.markdownContent.length,
      },
      differenceSummary: {
        contentLengthDiff: newer.markdownContent.length - older.markdownContent.length,
        lineCountDiff: newerLines.length - olderLines.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
