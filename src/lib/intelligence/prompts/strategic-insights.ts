import { CompetitorIntelligenceContext, MarketWideIntelligenceContext } from "../types";

export const STRATEGIC_INSIGHTS_SYSTEM_PROMPT = `You are a Principal SaaS Pricing Strategist & Executive Intelligence Analyst.
Your role is to analyze verified competitor pricing tables, historical snapshots, feature entitlements, and detected changes to produce high-value strategic intelligence and counter-action playbooks.

### STRICT RULES:
1. NEVER INVENT OR HALLUCINATE COMPETITORS, PRICES, OR CLAIMS. Every insight claim MUST be grounded directly in the provided context.
2. EVIDENCE GROUNDING: In each insight, include an "evidenceList" explicitly citing the exact observed plan names, price numbers, and detected changes from the input.
3. CLEAR INSIGHT CATEGORIES:
   - "pricing": Price hikes, decreases, paywalls, or currency shifts.
   - "packaging": Unbundling, feature movement between tiers, or seat limit alterations.
   - "discount": Annual promos, prepayment discounts, or introductory offers.
   - "positioning": Mid-market/enterprise targeting, developer-focused shifts.
   - "market_movement": Broader index trends across multiple competitors.
4. ACTION PLAYBOOK: For each insight, formulate concrete, pragmatic recommendations across Product, Sales, and Marketing teams.
5. CONCISE, EXECUTIVE-READY TONE: Avoid fluff, marketing buzzwords, or speculation. Focus on commercial impact, ACV risks, and competitive counter-measures.

Output strictly valid JSON matching the requested schema.`;

export function buildCompetitorInsightPrompt(ctx: CompetitorIntelligenceContext): string {
  return `TARGET COMPETITOR: ${ctx.competitorName} (${ctx.domain})
INDUSTRY: ${ctx.industry || "SaaS / Technology"}

--- VERIFIED ACTIVE PRICING PLANS (${ctx.activePlans.length}) ---
${JSON.stringify(ctx.activePlans, null, 2)}

--- DETECTED HISTORICAL CHANGES (${ctx.recentChanges.length}) ---
${JSON.stringify(ctx.recentChanges, null, 2)}

--- RECENT SOURCE SCRAPE OBSERVATIONS ---
${ctx.recentScrapes.map((s) => `Page: ${s.pageTitle || s.sourceUrl}\nSnippet: ${s.contentSnippet}`).join("\n\n")}

Analyze this verified data and generate actionable strategic insights, executive summaries, evidence citations, and department counter-action playbooks. Output pure JSON.`;
}

export function buildMarketWideInsightPrompt(ctx: MarketWideIntelligenceContext): string {
  return `MARKET-WIDE INTELLIGENCE CONTEXT:
Tracked Competitors: ${ctx.totalCompetitorsTracked}
Tracked Plans: ${ctx.totalPlansTracked}
Total Detected Changes: ${ctx.totalChangesInWindow}

--- COMPETITOR DATA BREAKDOWN ---
${ctx.competitors.map((c) => `Competitor: ${c.competitorName} (${c.domain})\nPlans: ${c.activePlans.map((p) => `${p.planName}: $${p.price || "custom"}`).join(", ")}\nRecent Changes: ${c.recentChanges.map((ch) => ch.description).join("; ")}`).join("\n\n")}

Analyze the overall competitive landscape, identify which competitors are becoming more expensive or unbundling value, and provide executive takeaways and market positioning playbooks. Output pure JSON.`;
}
