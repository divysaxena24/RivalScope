import { NextRequest } from "next/server";
import { db, competitors } from "@/lib/db";
import { eq } from "drizzle-orm";
import { updateCompetitorSchema, uuidSchema, extractDomain } from "@/schemas/api";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/competitors/[id]
 * Retrieves single competitor details with tracked URLs, pricing plans, and recent insights.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const validatedId = uuidSchema.parse(id);

    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, validatedId),
      with: {
        trackedUrls: true,
        pricingPlans: true,
        aiInsights: {
          limit: 5,
        },
      },
    });

    if (!competitor) {
      return errorResponse("Competitor not found", 404);
    }

    return successResponse(competitor);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/competitors/[id]
 * Updates competitor details safely.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const validatedId = uuidSchema.parse(id);
    const body = await req.json();
    const validated = updateCompetitorSchema.parse(body);

    const existing = await db.query.competitors.findFirst({
      where: eq(competitors.id, validatedId),
    });

    if (!existing) {
      return errorResponse("Competitor not found", 404);
    }

    const updateData: Partial<typeof competitors.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (validated.name !== undefined) updateData.name = validated.name.trim();
    if (validated.industry !== undefined) updateData.industry = validated.industry;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.logoUrl !== undefined) updateData.logoUrl = validated.logoUrl;
    if (validated.status !== undefined) updateData.status = validated.status;

    if (validated.website) {
      const newDomain = extractDomain(validated.website);
      if (newDomain !== existing.domain) {
        // Verify unique domain
        const duplicateDomain = await db.query.competitors.findFirst({
          where: eq(competitors.domain, newDomain),
        });
        if (duplicateDomain && duplicateDomain.id !== validatedId) {
          return errorResponse(`Domain "${newDomain}" is already used by another competitor.`, 409);
        }
        updateData.domain = newDomain;
      }
      updateData.website = validated.website.trim();
    }

    const [updated] = await db
      .update(competitors)
      .set(updateData)
      .where(eq(competitors.id, validatedId))
      .returning();

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/competitors/[id]
 * Deletes competitor and cascades deletion to tracked URLs, plans, snapshots, and insights.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const validatedId = uuidSchema.parse(id);

    const [deleted] = await db
      .delete(competitors)
      .where(eq(competitors.id, validatedId))
      .returning({ id: competitors.id, name: competitors.name });

    if (!deleted) {
      return errorResponse("Competitor not found", 404);
    }

    return successResponse({
      message: `Competitor "${deleted.name}" deleted successfully`,
      deletedId: deleted.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
