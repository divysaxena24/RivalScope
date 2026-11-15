import { NextRequest } from "next/server";
import { z } from "zod";
import { getGroqClient } from "@/lib/ai/client";
import { DEFAULT_EXTRACTION_CONFIG } from "@/lib/ai/model-config";
import { buildChatbotCompetitorContext } from "@/lib/intelligence/chat-context";
import {
  classifyQueryScope,
  normalizeChatError,
  OUT_OF_SCOPE_FRIENDLY_MESSAGE,
  INSUFFICIENT_DATA_FRIENDLY_MESSAGE,
} from "@/lib/intelligence/chat-intent";
import { successResponse, errorResponse } from "@/lib/api/response";
import { db } from "@/lib/db";
import { chatSessions, chatMessages, competitors } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

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
     | Competitor | Plan Name | Category | Price | Billing Period | Usage Limits / Quotas | Key Entitlements |
   - Format prices precisely with currency symbols (e.g. "$20.00", "₹1,950.00", "$0.00 (Free)", or "Contact Sales").
   - If usage limits are empty or not defined in the database, explicitly write "Not specified in database records". Never invent numbers or quotas.
   - When annual billing is presented, show both the monthly-equivalent rate and the total annual charge (e.g. "$17.00/mo ($204.00/yr)"). Never label a monthly-equivalent price as the full annual charge.
   - If there is a recorded data conflict (e.g. Copilot Max showing Contact Sales in DB vs $100/mo in scrape source), explicitly state the conflict in the table or notes instead of arbitrarily choosing one.
   - Never output duplicate plan rows for the same competitor.

3. **### 3. Product & Tier Differentiation (Consumer vs Enterprise Separation)**
   - Strictly separate Individual/Consumer/Prosumer plans from Team/Organizational/Enterprise plans.
   - Do not merge unrelated offerings (e.g. consumer Claude Free/Pro vs Claude Team/Enterprise; or Copilot Individual vs Copilot Business/Enterprise).
   - Use bullet points to highlight key plan features, distinct advantages, or tier limitations.
   - Contrast differences between tiers using strictly verified evidence from the database.

4. **### 4. Strategic Analysis & Recommendations (Grounded & Responsible)**
   - When proposing or evaluating strategy, clearly separate VERIFIED COMPETITOR FACTS from PROPOSED FEATURES or HYPOTHESES.
   - Do NOT claim a proposed plan is superior solely because it is cheaper. Evaluate trade-offs.
   - Ground recommendations in target customer profiles, usage limits, and infrastructure/inference cost assumptions.
   - Clearly label any unverified business assumptions with "[Assumption]".
   - Highlight packaging strategies (e.g., annual discount locks, usage metering vs flat rates) and recent movements from the audit log.

5. **### 5. Grounding & Data Notes**
   - Clearly state which records were drawn from the verified database.
   - Note any missing data points with complete transparency ("Usage limits are not specified in current records").
   - Report any pricing conflicts between source documentation and persisted database records.

### STRICT BOUNDING & GROUNDING RULES:
1. **GROUNDED FACTUAL REPLIES ONLY**:
   - Answer STRICTLY using the provided COMPETITIVE INTELLIGENCE DATA below.
   - Never invent model names (e.g. do NOT claim a plan includes a specific model like "GPT-4o", "Claude 3.5 Sonnet", "Gemini 1.5 Pro" unless that exact model is listed under Verified Features or Plan description). If not explicitly listed, state: "Not specified in database records".
   - If a specific price, feature, quota, or change is NOT mentioned in the provided data, explicitly write: "Not specified in database records". Never hallucinate or extrapolate hypothetical numbers.
   - Unknown pricing must remain unknown; Contact Sales must remain distinct from unknown pricing.
2. **SCOPE & ENTITY AWARENESS**:
   - Pay close attention to whether the user selected a single competitor, multiple competitors, or "All Competitors". Restrict your analysis accordingly.
   - Preserve currency symbols and regional offerings (e.g. INR vs USD).
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

    // 2.1 Fast Scope Classification: Reject clearly out-of-scope inquiries without expensive retrieval
    const activeCompetitorRecords = await db
      .select({ id: competitors.id, name: competitors.name })
      .from(competitors)
      .where(eq(competitors.status, "active"));

    const competitorNames = activeCompetitorRecords.map((c) => c.name);
    const scopeCheck = classifyQueryScope(latestUserMessage.content, competitorNames);

    if (!scopeCheck.inScope) {
      // Store out-of-scope friendly response directly
      await db.insert(chatMessages).values({
        sessionId: activeSessionId,
        role: "assistant",
        content: OUT_OF_SCOPE_FRIENDLY_MESSAGE,
        groundedCompetitorIds: [],
      });

      return successResponse({
        sessionId: activeSessionId,
        reply: OUT_OF_SCOPE_FRIENDLY_MESSAGE,
        groundedCompetitors: [],
        classification: "OUT_OF_SCOPE",
      });
    }

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
        classification: "INSUFFICIENT_DATA",
      });
    }

    // Check if competitor profile exists but has zero plans and zero features
    const totalDataPoints = activeComps.reduce(
      (acc, c) =>
        acc +
        c.plans.length +
        c.plans.reduce((fAcc, p) => fAcc + p.featureSnapshots.length, 0) +
        c.unassociatedFeatures.length +
        c.recentChanges.length,
      0
    );

    if (totalDataPoints === 0) {
      await db.insert(chatMessages).values({
        sessionId: activeSessionId,
        role: "assistant",
        content: INSUFFICIENT_DATA_FRIENDLY_MESSAGE,
        groundedCompetitorIds: activeComps.map((c) => c.id),
      });

      return successResponse({
        sessionId: activeSessionId,
        reply: INSUFFICIENT_DATA_FRIENDLY_MESSAGE,
        groundedCompetitors: activeComps.map((c) => ({
          id: c.id,
          name: c.name,
          domain: c.domain,
          planCount: 0,
          featureCount: 0,
          changeCount: 0,
        })),
        classification: "INSUFFICIENT_DATA",
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
        featureCount:
          c.plans.reduce((fAcc, p) => fAcc + p.featureSnapshots.length, 0) +
          c.unassociatedFeatures.length,
        changeCount: c.recentChanges.length,
      })),
    });
  } catch (err: unknown) {
    console.error("Error in insights chat route:", err);
    const normalized = normalizeChatError(err);
    return errorResponse(normalized.friendlyMessage, normalized.code, normalized.statusCode);
  }
}
