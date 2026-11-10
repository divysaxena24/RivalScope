import { NextRequest } from "next/server";
import { z } from "zod";
import { getGroqClient } from "@/lib/ai/client";
import { DEFAULT_EXTRACTION_CONFIG } from "@/lib/ai/model-config";
import { buildChatbotCompetitorContext } from "@/lib/intelligence/chat-context";
import { successResponse, errorResponse } from "@/lib/api/response";

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1),
    })
  ).min(1),
  competitorIds: z.array(z.string()).optional(), // Empty or ["all"] implies all competitors
});

const BOUNDED_SYSTEM_PROMPT = `You are RivalScope Strategic Intelligence Assistant, a factual, data-grounded competitive analyst.
You have real-time access to the user's verified competitive intelligence database containing tracked competitors, actual pricing tiers, packaging models, feature matrices, and historical price changes.

### STRICT BOUNDING RULES (MANDATORY):
1. **GROUNDED FACTUAL REPLIES ONLY**:
   - Answer the user's questions STRICTLY using the provided COMPETITIVE INTELLIGENCE DATA below.
   - If a specific price, feature, quota, or change is NOT mentioned in the provided data, clearly state: "Based on our current database records, this information is not specified." Never hallucinate or make up hypothetical numbers.
2. **SCOPE AWARENESS**:
   - The user may select a single competitor, multiple competitors, or all competitors. Pay close attention to which competitor(s) they are asking about.
   - If comparing competitors, provide direct, objective contrast matrices and bullet points based on the facts in the data.
3. **STRUCTURE & CLARITY**:
   - Provide crisp, executive-ready answers with markdown formatting (bullet points, bold highlights, concise comparison tables where helpful).
   - When citing prices, cite the exact amount, currency, and billing period (e.g. "$20/month", "₹1,950 INR/month", "Custom Enterprise").
4. **NO OFF-TOPIC RAMBLING**:
   - Keep answers tightly scoped to competitive strategy, pricing comparisons, feature entitlements, packaging shifts, and market positioning.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid chat request body: " + parsed.error.issues.map((i) => i.message).join(", "), "VALIDATION_ERROR", 400);
    }

    const { messages, competitorIds } = parsed.data;

    // 1. Fetch grounded competitor facts from Neon database
    const { competitors: activeComps, summaryText } = await buildChatbotCompetitorContext(competitorIds);

    if (activeComps.length === 0) {
      return successResponse({
        reply: "No active competitors found for the selected filter. Please select or track competitors first.",
        groundedCompetitors: [],
      });
    }

    // 2. Prepare Groq conversation with bounded context
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

    // 3. Request LLM completion
    const completion = await groq.chat.completions.create({
      model: DEFAULT_EXTRACTION_CONFIG.model,
      messages: groqMessages,
      temperature: 0.2, // Low temperature for high factual accuracy
      max_tokens: 1200,
    });

    const reply = completion.choices[0]?.message?.content || "I was unable to formulate a response from the current competitor data.";

    return successResponse({
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
