import { NextRequest } from "next/server";
import { POST } from "../app/api/insights/chat/route";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });

const questions = [
  // 1. Basic factual accuracy
  { id: 1, section: "1. Basic factual accuracy", q: "Which competitors offer a free plan, and what features are included?" },
  { id: 2, section: "1. Basic factual accuracy", q: "List all active pricing plans for every competitor, grouped by competitor." },
  { id: 3, section: "1. Basic factual accuracy", q: "Which competitors offer monthly and annual billing?" },
  { id: 4, section: "1. Basic factual accuracy", q: "Which plans have custom or contact-sales pricing?" },
  { id: 5, section: "1. Basic factual accuracy", q: "Which competitor has the cheapest paid monthly subscription?" },

  // 2. Cross-competitor comparisons
  { id: 6, section: "2. Cross-competitor comparisons", q: "Compare ChatGPT Plus, Claude Pro, Gemini AI Pro, and Perplexity Pro." },
  { id: 7, section: "2. Cross-competitor comparisons", q: "Compare the free plans of all five competitors." },
  { id: 8, section: "2. Cross-competitor comparisons", q: "Which competitors offer coding-focused features?" },
  { id: 9, section: "2. Cross-competitor comparisons", q: "Compare enterprise offerings across all competitors." },
  { id: 10, section: "2. Cross-competitor comparisons", q: "Which competitors provide usage credits, and how much?" },

  // 3. Accuracy and hallucination tests
  { id: 11, section: "3. Accuracy and hallucination tests", q: "Does GitHub Copilot offer a $100/month Max plan? Show the supporting source and any conflicting database records." },
  { id: 12, section: "3. Accuracy and hallucination tests", q: "Does Gemini offer Gemini 4 Argon? Show the evidence." },
  { id: 13, section: "3. Accuracy and hallucination tests", q: "Which competitors offer GPT-6 Astra?" },
  { id: 14, section: "3. Accuracy and hallucination tests", q: "What are Claude Team's exact features compared with Claude Enterprise?" },
  { id: 15, section: "3. Accuracy and hallucination tests", q: "Are Perplexity Pro and Max prices monthly charges or annual billing equivalents?" },

  // 4. Strategic intelligence
  { id: 16, section: "4. Strategic intelligence", q: "What features are common across all five competitors?" },
  { id: 17, section: "4. Strategic intelligence", q: "Identify three underserved customer needs based on the available competitor data." },
  { id: 18, section: "4. Strategic intelligence", q: "Design a free plan that can compete with existing free offerings." },
  { id: 19, section: "4. Strategic intelligence", q: "Design three subscription tiers for a new AI productivity startup, with pricing justification." },
  { id: 20, section: "4. Strategic intelligence", q: "Which competitor has the strongest value proposition for developers, based only on available evidence?" },

  // 5. Context and error handling
  { id: 21, section: "5. Context and error handling", q: "Compare only Claude and Gemini. Do not include other competitors.", competitorIds: ["844400e2-9fc2-48a7-80ad-89ade4cef862", "7012d003-f59d-4bcb-bef5-2b1a3f8aae95"] },
  { id: 22, section: "5. Context and error handling", q: "Compare Copilot Pro+ with ChatGPT Plus.", competitorIds: ["1e75bfb8-1f33-4f7c-9b7b-b57ef47d877b", "6b443847-d0c0-4215-a01a-56ab70c230a2"] },
  { id: 23, section: "5. Context and error handling", q: "Which competitor has the most missing pricing or feature information?" },
  { id: 24, section: "5. Context and error handling", q: "What information could not be verified from the latest database records?" },
  { id: 25, section: "5. Context and error handling", q: "Give me a comparison of all competitors using only the latest successful observations." },
];

async function runAudit() {
  console.log(`Starting RivalScope AI Insights 25-Question Comprehensive Audit...`);
  const results = [];

  for (const item of questions) {
    console.log(`\n==================================================`);
    console.log(`[Q${item.id}/25] (${item.section})`);
    console.log(`Query: "${item.q}"`);

    const t0 = Date.now();
    try {
      const mockReq = new NextRequest("http://localhost:3000/api/insights/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: item.q }],
          competitorIds: item.competitorIds || ["all"],
        }),
      });

      const res = await POST(mockReq);
      const json = await res.json();
      const durationMs = Date.now() - t0;

      if (!json.success) {
        console.error(`Status: FAILED (${durationMs}ms) Error:`, json.error);
        results.push({ id: item.id, q: item.q, success: false, error: json.error, durationMs });
        continue;
      }

      const reply = json.data?.reply || "";
      const isDeterministic = !!json.data?.isDeterministic;
      console.log(`Status: SUCCESS in ${durationMs}ms | Deterministic: ${isDeterministic}`);
      console.log(`Reply Preview (first 250 chars):\n${reply.slice(0, 250)}...\n`);

      results.push({
        id: item.id,
        section: item.section,
        q: item.q,
        success: true,
        isDeterministic,
        durationMs,
        reply,
      });
    } catch (err: any) {
      const durationMs = Date.now() - t0;
      console.error(`Status: EXCEPTION (${durationMs}ms):`, err.message);
      results.push({ id: item.id, q: item.q, success: false, error: err.message, durationMs });
    }
  }

  fs.writeFileSync("audit-25-results.json", JSON.stringify(results, null, 2), "utf8");
  console.log(`\nAudit complete! Saved 25 results to audit-25-results.json`);
}

runAudit();

