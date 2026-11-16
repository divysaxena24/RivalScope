import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { askChatbot } from "./run-qa-suite";

const FIVE_COMPETITOR_IDS = [
  "6b443847-d0c0-4215-a01a-56ab70c230a2", // ChatGPT
  "4ef3b5d1-b6c9-4fb6-afe2-6467efb21927", // Perplexity
  "844400e2-9fc2-48a7-80ad-89ade4cef862", // Claude
  "7012d003-f59d-4bcb-bef5-2b1a3f8aae95", // Gemini
  "1e75bfb8-1f33-4f7c-9b7b-b57ef47d877b", // Copilot
];

const chatgptId = "6b443847-d0c0-4215-a01a-56ab70c230a2";
const claudeId = "844400e2-9fc2-48a7-80ad-89ade4cef862";
const geminiId = "7012d003-f59d-4bcb-bef5-2b1a3f8aae95";
const perplexityId = "4ef3b5d1-b6c9-4fb6-afe2-6467efb21927";
const copilotId = "1e75bfb8-1f33-4f7c-9b7b-b57ef47d877b";

async function run() {
  const allTests = [
    // Cat 1
    { num: 1, comps: FIVE_COMPETITOR_IDS, prompt: "List every active pricing plan for all selected competitors, including monthly price, annual price, currency, and billing period." },
    { num: 6, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitor has the highest-priced publicly listed plan?" },
    { num: 7, comps: FIVE_COMPETITOR_IDS, prompt: "Are there any duplicate or similarly named plans across competitors?" },
    { num: 8, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitors have missing or unverified pricing information?" },
    // Cat 2
    { num: 9, comps: FIVE_COMPETITOR_IDS, prompt: "Compare the AI capabilities included in the entry-level paid plans of all competitors." },
    { num: 10, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitors offer coding-focused features?" },
    { num: 11, comps: FIVE_COMPETITOR_IDS, prompt: "Compare file upload, image generation, research, and context-window capabilities." },
    { num: 12, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitors offer team or enterprise features?" },
    { num: 13, comps: FIVE_COMPETITOR_IDS, prompt: "Identify features available in one competitor but missing from the others." },
    { num: 14, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitor provides the most value for developers? Support the answer with extracted data." },
    { num: 15, comps: FIVE_COMPETITOR_IDS, prompt: "Create a feature comparison table showing Included, Not Included, Limited, and Unknown separately." },
    // Cat 3
    { num: 16, comps: FIVE_COMPETITOR_IDS, prompt: "What is the exact monthly price of Copilot Max? Show the source evidence and flag any conflict between stored pricing and extracted source data." },
    { num: 17, comps: FIVE_COMPETITOR_IDS, prompt: "Does Gemini offer a plan called Gemini 4 Argon? Show evidence or explicitly say you cannot verify it." },
    { num: 18, comps: FIVE_COMPETITOR_IDS, prompt: "Does ChatGPT offer GPT-6 Astra? Provide the source supporting your answer." },
    { num: 19, comps: FIVE_COMPETITOR_IDS, prompt: "Is Perplexity Pro priced at $17/month or $20/month? Explain the billing difference, if any." },
    { num: 20, comps: FIVE_COMPETITOR_IDS, prompt: "Does Claude have separate Team and Enterprise plans? Show their individual pricing and evidence." },
    { num: 21, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitors offer unlimited usage? Only include this if the source explicitly supports the claim." },
    { num: 22, comps: FIVE_COMPETITOR_IDS, prompt: "Are there any conflicting prices or feature descriptions in the stored competitor data?" },
    // Cat 4
    { num: 23, comps: FIVE_COMPETITOR_IDS, prompt: "Based on the competitor data, identify the biggest gap in the current AI subscription market." },
    { num: 24, comps: FIVE_COMPETITOR_IDS, prompt: "Design a subscription pricing strategy that could compete with all five competitors." },
    { num: 25, comps: FIVE_COMPETITOR_IDS, prompt: "Recommend three pricing tiers for a new AI product, including target users, prices, features, and differentiation." },
    { num: 26, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitor should a new AI startup benchmark for its free plan?" },
    { num: 27, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitor has the strongest developer-focused offering?" },
    { num: 28, comps: FIVE_COMPETITOR_IDS, prompt: "What features could help a new AI product differentiate itself rather than simply copy competitors?" },
    // Cat 5
    { num: 29, comps: [chatgptId, claudeId], prompt: "Compare their paid plans and coding features." },
    { num: 30, comps: [geminiId, perplexityId], prompt: "Compare their free tiers and research capabilities." },
    { num: 31, comps: [copilotId, chatgptId, claudeId], prompt: "Compare their most expensive publicly priced plans." },
    { num: 32, comps: FIVE_COMPETITOR_IDS, prompt: "Which competitor has the best value for a student?" },
    { num: 33, comps: [claudeId], prompt: "List Claude's active plans and pricing." },
    { num: 34, comps: FIVE_COMPETITOR_IDS, prompt: "Now compare only their annual billing options." },
  ];

  for (const t of allTests) {
    console.log(`\n======================================================`);
    console.log(`RUNNING TEST ${t.num}: "${t.prompt}"`);
    console.log(`COMPETITORS: ${t.comps.length}`);
    console.log(`======================================================`);
    try {
      const res = await askChatbot(t.prompt, t.comps);
      console.log(`TYPE: ${res.type}`);
      console.log(`RESPONSE_SNIPPET:\n${res.response.slice(0, 500)}...\n(Total length: ${res.response.length})`);
    } catch (e: any) {
      console.error(`ERROR IN TEST ${t.num}:`, e.message);
    }
    // Small delay between calls to preserve rate limits
    await new Promise((r) => setTimeout(r, 2000));
  }
}

run().then(() => process.exit(0)).catch(console.error);
