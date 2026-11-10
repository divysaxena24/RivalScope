import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";

// GET /api/insights/sessions -> Lists chat sessions ordered by updatedAt
export async function GET() {
  try {
    const sessions = await db
      .select()
      .from(chatSessions)
      .orderBy(desc(chatSessions.updatedAt))
      .limit(30);

    return successResponse({ sessions });
  } catch (err: any) {
    console.error("Error fetching chat sessions:", err);
    return errorResponse(err?.message || "Failed to fetch chat sessions", "INTERNAL_ERROR", 500);
  }
}

// POST /api/insights/sessions -> Creates a new chat session
const CreateSessionSchema = z.object({
  title: z.string().optional(),
  selectedCompetitors: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSessionSchema.safeParse(body);
    const data = parsed.success ? parsed.data : {};

    const [session] = await db
      .insert(chatSessions)
      .values({
        title: data.title || "New Analysis Session",
        selectedCompetitors: data.selectedCompetitors || ["all"],
      })
      .returning();

    return successResponse({ session });
  } catch (err: any) {
    console.error("Error creating chat session:", err);
    return errorResponse(err?.message || "Failed to create chat session", "INTERNAL_ERROR", 500);
  }
}
