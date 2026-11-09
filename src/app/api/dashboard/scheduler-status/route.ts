import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { monitoringRuns, monitoringJobs } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { successResponse, handleApiError } from "@/lib/api-response";

/**
 * GET /api/dashboard/scheduler-status
 * Returns the most recent monitoring run, upcoming scheduled execution time, and summary telemetry.
 */
export async function GET(req: NextRequest) {
  try {
    const latestRun = await db.query.monitoringRuns.findFirst({
      orderBy: [desc(monitoringRuns.startedAt)],
      with: {
        jobs: {
          limit: 10,
          with: {
            competitor: {
              columns: { id: true, name: true },
            },
            trackedUrl: {
              columns: { id: true, url: true },
            },
          },
        },
      },
    });

    // Compute next scheduled execution:
    // Schedule: Daily at 09:00 AM IST (Asia/Kolkata: UTC+05:30).
    // In UTC, 09:00 IST is exactly 03:30 AM UTC.
    // Using explicit Date math in UTC to avoid server host timezone bias:
    const now = new Date();
    const nextCron = new Date(now);
    nextCron.setUTCHours(3, 30, 0, 0);

    // If current time is past 03:30:00.000 UTC today, the next run is tomorrow at 03:30 UTC
    if (now.getTime() >= nextCron.getTime()) {
      nextCron.setUTCDate(nextCron.getUTCDate() + 1);
    }

    return successResponse({
      latestRun: latestRun
        ? {
            id: latestRun.id,
            runType: latestRun.runType,
            status: latestRun.status,
            totalCompetitors: Number(latestRun.totalCompetitors),
            totalUrls: Number(latestRun.totalUrls),
            successfulScrapes: Number(latestRun.successfulScrapes),
            failedScrapes: Number(latestRun.failedScrapes),
            detectedPriceChanges: Number(latestRun.detectedPriceChanges),
            detectedFeatureChanges: Number(latestRun.detectedFeatureChanges),
            startedAt: latestRun.startedAt.toISOString(),
            completedAt: latestRun.completedAt ? latestRun.completedAt.toISOString() : null,
            errorMessage: latestRun.errorMessage,
            recentJobs: (latestRun.jobs || []).map((j) => ({
              id: j.id,
              competitorName: j.competitor?.name || "Unknown",
              url: j.trackedUrl?.url || "",
              status: j.status,
              changesCount: Number(j.detectedChangesCount),
              retryCount: Number(j.retryCount),
            })),
          }
        : null,
      schedule: {
        frequency: "Daily at 09:00 AM IST (03:30 AM UTC)",
        nextScheduledRun: nextCron.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
