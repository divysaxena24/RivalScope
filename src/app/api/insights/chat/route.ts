import { NextRequest } from "next/server";
import { z } from "zod";
import { getGroqClient } from "@/lib/ai/client";
import { DEFAULT_EXTRACTION_CONFIG } from "@/lib/ai/model-config";
import { buildChatbotCompetitorContext } from "@/lib/intelligence/chat-context";
import { successResponse, errorResponse } from "@/lib/api/response";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ChatRequestSchema = z.object({
  sessionId: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1),
    })
  ).min(1),
  competitorIds: z.array(z.string()).optional(), // Empty or ["all"] implies all competitors
});

const BOUNDED_SYSTEM_PROMPT = `You are RivalScope Strategic Intelligence Assistant, an elite competitive analyst and pricing strategist.
You have real-time access to the user's verified competitive intelligence database containing tracked competitors, actual pricing tiers, packaging models, feature matrices, and historical price changes.

### MANDATORY OUTPUT STRUCTURE REQUIREMENTS:
Every response you generate MUST be clearly structured using clean Markdown formatting. Do not output unstructured prose or conversational filler. Always organize your response with the following sections:

1. **### 1. Executive Summary**
   - Provide a direct, 2-3 sentence strategic executive takeaway answering the user's inquiry directly.
   - Mention the competitors analyzed and their core market positioning.

2. **### 2. Pricing & Packaging Matrix**
   - When plans or pricing are discussed or compared, you MUST provide a structured Markdown table with the following exact columns:
     | Competitor | Plan Name | Price | Billing Period | Usage Limits / Quotas | Key Entitlements |
   - Format prices precisely with currency symbols (e.g. "$20.00", "₹1,950.00", "$0.00 (Free)", or "Custom/Enterprise").
   - If usage limits are empty or not defined in the database, explicitly write "Not specified in database records". Never invent numbers or quotas.
   - Never output duplicate plan rows for the same competitor.

3. **### 3. Feature Breakdown & Tier Differentiation**
   - Use bullet points to highlight key plan features, distinct advantages, or tier limitations.
   - Contrast differences between lower and higher tiers (e.g., Free vs Pro vs Enterprise).

4. **### 4. Strategic Observations & Recent Movements**
   - Mention any recent pricing changes or detected movements from the historical audit log.
   - Highlight packaging strategies (e.g., annual discount locks, usage metering vs flat rates).

5. **### 5. Grounding & Data Notes**
   - Clearly state which records were drawn from the verified database.
   - Note any missing data points with complete transparency ("Usage limits are not specified in current records").

### STRICT BOUNDING & GROUNDING RULES:
1. **GROUNDED FACTUAL REPLIES ONLY**:
   - Answer STRICTLY using the provided COMPETITIVE INTELLIGENCE DATA below.
   - If a specific price, feature, quota, or change is NOT mentioned in the provided data, explicitly write: "Not specified in database records". Never hallucinate or extrapolate hypothetical numbers.
2. **SCOPE AWARENESS**:
   - Pay close attention to whether the user selected a single competitor, multiple competitors, or "All Competitors". Restrict your analysis accordingly.
3. **NO OFF-TOPIC RAMBLING**:
   - Keep answers tightly scoped to competitive strategy, pricing comparisons, feature entitlements, packaging shifts, and market positioning.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "Invalid chat request body: " + parsed.error.issues.map((i) => i.message).join(", "),
        "VALIDATION_ERROR",
        400
      );
    }

    const { messages, competitorIds = ["all"], sessionId: requestedSessionId } = parsed.data;
    const latestUserMessage = messages[messages.length - 1];

    // 1. Ensure or create Session
    let activeSessionId = requestedSessionId;
    if (!activeSessionId) {
      // Auto-generate concise title from the user prompt
      const titleSnippet = latestUserMessage.content.slice(0, 50).trim() || "Competitive Analysis";
      const [newSession] = await db
        .insert(chatSessions)
        .values({
          title: titleSnippet,
          selectedCompetitors: competitorIds,
        })
        .returning();
      activeSessionId = newSession.id;
    } else {
      // Update session's selected competitors & timestamp
      await db
        .update(chatSessions)
        .set({
          selectedCompetitors: competitorIds,
          updatedAt: new Date(),
        })
        .where(eq(chatSessions.id, activeSessionId));
    }

    // 2. Persist the User's Message to DB
    await db.insert(chatMessages).values({
      sessionId: activeSessionId,
      role: "user",
      content: latestUserMessage.content,
      groundedCompetitorIds: competitorIds,
    });

    // 3. Fetch grounded competitor facts from Neon database
    const { competitors: activeComps, summaryText } = await buildChatbotCompetitorContext(competitorIds);

    if (activeComps.length === 0) {
      const fallbackReply = "No active competitors found for the selected filter. Please track or activate competitors first.";
      await db.insert(chatMessages).values({
        sessionId: activeSessionId,
        role: "assistant",
        content: fallbackReply,
        groundedCompetitorIds: [],
      });

      return successResponse({
        sessionId: activeSessionId,
        reply: fallbackReply,
        groundedCompetitors: [],
      });
    }

    // 4. Request LLM completion with bounded context
    const groq = getGroqClient();

    const systemMessage = `${BOUNDED_SYSTEM_PROMPT}

### VERIFIED COMPETITIVE INTELLIGENCE DATA (GROUND TRUTH):
${summaryText}
`;

    const groqMessages = [
      { role: "system" as const, content: systemMessage },
      ...messages.slice(-8).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    const completion = await groq.chat.completions.create({
      model: DEFAULT_EXTRACTION_CONFIG.model,
      messages: groqMessages,
      temperature: 0.2, // Low temperature for high factual precision
      max_tokens: 1200,
    });

    const reply = completion.choices[0]?.message?.content || "I was unable to formulate a response from the current competitor data.";

    // 5. Persist Assistant Message to DB
    const groundedIds = activeComps.map((c) => c.id);
    await db.insert(chatMessages).values({
      sessionId: activeSessionId,
      role: "assistant",
      content: reply,
      groundedCompetitorIds: groundedIds,
    });

    // Update session title if it's the first exchange
    if (!requestedSessionId) {
      const refinedTitle = latestUserMessage.content.slice(0, 45).trim();
      await db
        .update(chatSessions)
        .set({ title: refinedTitle, updatedAt: new Date() })
        .where(eq(chatSessions.id, activeSessionId));
    }

    return successResponse({
      sessionId: activeSessionId,
      reply,
      groundedCompetitors: activeComps.map((c) => ({
        id: c.id,
        name: c.name,
        domain: c.domain,
        planCount: c.plans.length,
        featureCount: c.features.length,
        changeCount: c.recentChanges.length,
      })),
    });
  } catch (err: any) {
    console.error("Error in insights chat route:", err);
    return errorResponse(err?.message || "Internal server error during chat processing", "INTERNAL_ERROR", 500);
  }
}
