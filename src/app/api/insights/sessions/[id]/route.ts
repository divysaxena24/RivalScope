import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";

// GET /api/insights/sessions/[id] -> Gets session details and all its messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, id),
    });

    if (!session) {
      return errorResponse("Chat session not found", "NOT_FOUND", 404);
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, id))
      .orderBy(asc(chatMessages.createdAt));

    return successResponse({
      session,
      messages,
    });
  } catch (err: any) {
    console.error("Error fetching session messages:", err);
    return errorResponse(err?.message || "Failed to fetch session", "INTERNAL_ERROR", 500);
  }
}

// DELETE /api/insights/sessions/[id] -> Deletes a chat session
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.delete(chatSessions).where(eq(chatSessions.id, id));

    return successResponse({ message: "Session deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting session:", err);
    return errorResponse(err?.message || "Failed to delete session", "INTERNAL_ERROR", 500);
  }
}
