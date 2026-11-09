import { NextRequest } from "next/server";
import { executeMonitoringRun } from "@/lib/monitoring/scheduler-service";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

/**
 * GET or POST /api/cron/daily-monitor
 * Protected endpoint triggered daily by Vercel Cron.
 * Authenticates via Authorization header (Bearer <CRON_SECRET>).
 */
export async function GET(req: NextRequest) {
  return handleCronTrigger(req);
}

export async function POST(req: NextRequest) {
  return handleCronTrigger(req);
}

async function handleCronTrigger(req: NextRequest) {
  try {
    // 1. Authenticate Request
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Fail closed: in production or if CRON_SECRET is configured, require exact Bearer match
    if (process.env.NODE_ENV === "production" || cronSecret) {
      if (!cronSecret) {
        return errorResponse("Server misconfiguration: CRON_SECRET is required in production", 500);
      }
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return errorResponse("Unauthorized: Invalid or missing CRON_SECRET", 401);
      }
    } else {
      // Local development fallback: only allow localhost / 127.0.0.1
      const host = req.headers.get("host") || "";
      const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
      if (!isLocal) {
        return errorResponse("Unauthorized: CRON_SECRET environment variable is required", 401);
      }
    }

    // 2. Execute Daily Monitoring Run
    const outcome = await executeMonitoringRun({
      runType: "scheduled",
      forcedBy: "Vercel Cron",
    });

    return successResponse({
      message: "Daily competitor monitoring run completed successfully",
      run: outcome,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("already actively executing")) {
      return errorResponse(error.message, 409);
    }
    return handleApiError(error);
  }
}
