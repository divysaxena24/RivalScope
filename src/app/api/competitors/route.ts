import { NextRequest } from "next/server";
import { db, competitors, trackedUrls } from "@/lib/db";
import { desc, count, eq } from "drizzle-orm";
import { createCompetitorSchema, extractDomain } from "@/schemas/api";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

/**
 * GET /api/competitors
 * Returns a list of all monitored competitors, ordered by most recently updated.
 */
export async function GET() {
  try {
    const list = await db.query.competitors.findMany({
      orderBy: [desc(competitors.createdAt)],
      with: {
        trackedUrls: true,
        pricingPlans: true,
      },
    });

    return successResponse(list);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/competitors
 * Registers a new competitor for monitoring and creates an initial tracked URL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = createCompetitorSchema.parse(body);

    const domain = extractDomain(validated.website);

    // Check for existing competitor by domain
    const existing = await db.query.competitors.findFirst({
      where: eq(competitors.domain, domain),
    });

    if (existing) {
      return errorResponse(
        `A competitor with domain "${domain}" is already being monitored.`,
        409
      );
    }

    // Insert competitor
    const [newCompetitor] = await db
      .insert(competitors)
      .values({
        name: validated.name.trim(),
        website: validated.website.trim(),
        domain,
        industry: validated.industry?.trim() || null,
        description: validated.description?.trim() || null,
        logoUrl: validated.logoUrl?.trim() || null,
      })
      .returning();

    // Automatically create initial tracked URL for the website provided
    await db.insert(trackedUrls).values({
      competitorId: newCompetitor.id,
      url: validated.website.trim(),
      pageType: "pricing",
      isActive: true,
    });

    return successResponse(newCompetitor, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
