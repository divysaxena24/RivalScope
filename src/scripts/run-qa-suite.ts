import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { buildChatbotCompetitorContext } from "../lib/intelligence/chat-context";
import { getGroqClient } from "../lib/ai/client";
import { DEFAULT_EXTRACTION_CONFIG } from "../lib/ai/model-config";
import { identifyDeterministicQuery, executeDeterministicQuery } from "../lib/intelligence/deterministic-queries";
import { verifyAndSanitizeResponse } from "../lib/intelligence/evidence-guard";

const FIVE_COMPETITOR_IDS = [
  "6b443847-d0c0-4215-a01a-56ab70c230a2", // ChatGPT
  "4ef3b5d1-b6c9-4fb6-afe2-6467efb21927", // Perplexity
  "844400e2-9fc2-48a7-80ad-89ade4cef862", // Claude
  "7012d003-f59d-4bcb-bef5-2b1a3f8aae95", // Gemini
  "1e75bfb8-1f33-4f7c-9b7b-b57ef47d877b", // Copilot
];

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

4. **### 4. Derived Observations**
   - Provide analytical synthesis drawn strictly from the facts above (e.g. comparison of price per month across tiers, common tier structures).

5. **### 5. Strategic Recommendations & Assumptions (Grounded & Responsible)**
   - When proposing or evaluating strategy, clearly separate VERIFIED COMPETITOR FACTS from PROPOSED FEATURES or HYPOTHESES.
   - Do NOT claim a proposed plan is superior solely because it is cheaper. Evaluate trade-offs.
   - Ground recommendations in target customer profiles, usage limits, and infrastructure/inference cost assumptions.
   - Clearly label any unverified business assumptions with "[Assumption]".
   - Highlight packaging strategies (e.g., annual discount locks, usage metering vs flat rates) and recent movements from the audit log.

6. **### 6. Grounding & Data Notes**
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

export async function askChatbot(prompt: string, competitorIds: string[]) {
  const { competitors: compContexts, summaryText } = await buildChatbotCompetitorContext(
    competitorIds,
    false,
    "all"
  );

  const matchedPattern = identifyDeterministicQuery(prompt, compContexts.map(c => c.name));
  if (matchedPattern && matchedPattern.isDeterministic && matchedPattern.type) {
    const deterministicResult = executeDeterministicQuery(matchedPattern.type, compContexts, matchedPattern.targetCompetitor);
    if (deterministicResult) {
      return {
        type: "deterministic",
        pattern: matchedPattern.type,
        response: deterministicResult.markdownReply,
      };
    }
  }

  const groq = getGroqClient();
  const systemPromptWithContext = `${BOUNDED_SYSTEM_PROMPT}

### VERIFIED COMPETITIVE INTELLIGENCE DATA (READ-ONLY GROUND TRUTH):
${summaryText}`;

  const completion = await groq.chat.completions.create({
    model: DEFAULT_EXTRACTION_CONFIG.model,
    messages: [
      { role: "system", content: systemPromptWithContext },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_completion_tokens: 3500,
  });

  const rawAnswer = completion.choices[0]?.message?.content || "";
  const verification = verifyAndSanitizeResponse(rawAnswer, compContexts);

  return {
    type: "llm",
    response: verification.sanitizedText,
  };
}

async function runSingleBatch(tests: Array<{ num: number; prompt: string; comps: string[] }>) {
  for (const t of tests) {
    console.log(`\n======================================================`);
    console.log(`TEST ${t.num}: PROMPT: "${t.prompt}"`);
    console.log(`======================================================`);
    try {
      const res = await askChatbot(t.prompt, t.comps);
      console.log(`[TYPE]: ${res.type}`);
      console.log(`[FULL_RESPONSE_START]\n${res.response}\n[FULL_RESPONSE_END]`);
    } catch (e: any) {
      console.error(`ERROR IN TEST ${t.num}:`, e.message);
    }
  }
}

const arg = process.argv[2] || "1";
if (arg === "1") {
  // Test 1-8
  const tests = [
    { num: 1, comps: FIVE_COMPETITOR_IDS, prompt: "List every active pricing plan for all selected competitors, including monthly price, annual price, currency, and billing period." },
    { num: 2, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitors offer a free plan? Compare their free-tier limitations." },
    { num: 3, comps: FIVE_COMPETITOR_IDS, prompt: "Compare the cheapest paid plan from each competitor." },
    { num: 4, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitors offer annual billing? Show actual annual prices separately from monthly-equivalent prices." },
    { num: 5, comps: FIVE_COMPETITOR_IDS, prompt: "Which plans have custom or contact-sales pricing?" },
    { num: 6, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitor has the highest-priced publicly listed plan?" },
    { num: 7, comps: FIVE_COMPETITOR_IDS, prompt: "Are there any duplicate or similarly named plans across competitors?" },
    { num: 8, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitors have missing or unverified pricing information?" },
  ];
  runSingleBatch(tests).then(() => process.exit(0)).catch(console.error);
} else if (arg === "2") {
  // Test 9-15
  const tests = [
    { num: 9, comps: FIVE_COMPETITOR_IDS, prompt: "Compare the AI capabilities included in the entry-level paid plans of all competitors." },
    { num: 10, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitors offer coding-focused features?" },
    { num: 11, comps: FIVE_COMPETITOR_IDS, prompt: "Compare file upload, image generation, research, and context-window capabilities." },
    { num: 12, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitors offer team or enterprise features?" },
    { num: 13, comps: FIVE_COMPETITOR_IDS, prompt: "Identify features available in one competitor but missing from the others." },
    { num: 14, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitor provides the most value for developers? Support the answer with extracted data." },
    { num: 15, comps: FIVE_COMPETITOR_IDS, prompt: "Create a feature comparison table showing Included, Not Included, Limited, and Unknown separately." },
  ];
  runSingleBatch(tests).then(() => process.exit(0)).catch(console.error);
} else if (arg === "3") {
  // Test 16-22
  const tests = [
    { num: 16, comps: FIVE_COMPETITOR_IDS, prompt: "What is the exact monthly price of Copilot Max? Show the source evidence and flag any conflict between stored pricing and extracted source data." },
    { num: 17, comps: FIVE_COMPETITOR_IDS, prompt: "Does Gemini offer a plan called Gemini 4 Argon? Show evidence or explicitly say you cannot verify it." },
    { num: 18, comps: FIVE_COMPETITOR_IDS, prompt: "Does ChatGPT offer GPT-6 Astra? Provide the source supporting your answer." },
    { num: 19, comps: FIVE_COMPETITOR_IDS, prompt: "Is Perplexity Pro priced at $17/month or $20/month? Explain the billing difference, if any." },
    { num: 20, comps: FIVE_COMPETITOR_IDS, prompt: "Does Claude have separate Team and Enterprise plans? Show their individual pricing and evidence." },
    { num: 21, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitors offer unlimited usage? Only include this if the source explicitly supports the claim." },
    { num: 22, comps: FIVE_COMPETITOR_IDS, prompt: "Are there any conflicting prices or feature descriptions in the stored competitor data?" },
  ];
  runSingleBatch(tests).then(() => process.exit(0)).catch(console.error);
} else if (arg === "4") {
  // Test 23-28
  const tests = [
    { num: 23, comps: FIVE_COMPETITOR_IDS, prompt: "Based on the competitor data, identify the biggest gap in the current AI subscription market." },
    { num: 24, comps: FIVE_COMPETITOR_IDS, prompt: "Design a subscription pricing strategy that could compete with all five competitors." },
    { num: 25, comps: FIVE_COMPETITOR_IDS, prompt: "Recommend three pricing tiers for a new AI product, including target users, prices, features, and differentiation." },
    { num: 26, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitor should a new AI startup benchmark for its free plan?" },
    { num: 27, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitor has the strongest developer-focused offering?" },
    { num: 28, comps: FIVE_COMPETITOR_IDS, prompt: "What features could help a new AI product differentiate itself rather than simply copy competitors?" },
  ];
  runSingleBatch(tests).then(() => process.exit(0)).catch(console.error);
} else if (arg === "5") {
  // Test 29-34
  const chatgptId = "6b443847-d0c0-4215-a01a-56ab70c230a2";
  const claudeId = "844400e2-9fc2-48a7-80ad-89ade4cef862";
  const geminiId = "7012d003-f59d-4bcb-bef5-2b1a3f8aae95";
  const perplexityId = "4ef3b5d1-b6c9-4fb6-afe2-6467efb21927";
  const copilotId = "1e75bfb8-1f33-4f7c-9b7b-b57ef47d877b";

  const tests = [
    { num: 29, comps: [chatgptId, claudeId], prompt: "Compare their paid plans and coding features." },
    { num: 30, comps: [geminiId, perplexityId], prompt: "Compare their free tiers and research capabilities." },
    { num: 31, comps: [copilotId, chatgptId, claudeId], prompt: "Compare their most expensive publicly priced plans." },
    { num: 32, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitor has the best value for a student?" },
    { num: 33, comps: [claudeId], prompt: "List Claude's active plans and pricing." },
    { num: 34, comps: FIVE_COMPETITOR_IDS, prompt: "Now compare only their annual billing options." },
  ];
  runSingleBatch(tests).then(() => process.exit(0)).catch(console.error);
}
