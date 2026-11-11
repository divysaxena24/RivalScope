import { describe, it, expect } from "vitest";
import { preprocessMarkdownForExtraction } from "../preprocess-markdown";
import { extractMarkdownTables } from "../table-extractor";
import { extractCandidatePlanNames, extractCandidatePrices } from "../pricing-section-detector";
import { chunkMarkdownForExtraction } from "../../extraction/markdown-chunker";
import { getModelTokenBudget, ModelTokenBudget } from "../../extraction/token-budget";

describe("Universal Pre-Extraction Intelligence Layer (15 Scenarios)", () => {
  // Scenario 1: Simple Markdown pricing page
  it("Scenario 1: correctly processes a simple markdown pricing page", () => {
    const markdown = `
# Acme Cloud Pricing
Simple, transparent pricing for teams of all sizes.

## Starter
- Price: $19/mo
- 5 users included
- Basic analytics
- Email support

## Professional
- Price: $49/mo
- 20 users included
- Advanced analytics
- Priority support

## Enterprise
- Contact sales for custom volume pricing
- Unlimited users
- Dedicated account manager
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.status).toBe("OPTIMIZED");
    expect(result.metrics.candidatePricesFound).toBeGreaterThanOrEqual(2);
    expect(result.metrics.candidatePlansFound).toContain("Starter");
    expect(result.metrics.candidatePlansFound).toContain("Professional");
    expect(result.preprocessedMarkdown).toContain("Starter");
    expect(result.preprocessedMarkdown).toContain("$19/mo");
    expect(result.preprocessedMarkdown).toContain("Professional");
    expect(result.preprocessedMarkdown).toContain("$49/mo");
    expect(result.preprocessedMarkdown).toContain("Enterprise");
  });

  // Scenario 2: Large marketing page with navigation and footer
  it("Scenario 2: strips navigation and footer boilerplate while preserving pricing", () => {
    const markdown = `
[Skip to main content](#content)
[Home](/) | [Features](/features) | [About Us](/about) | [Careers](/careers) | [Login](/login)

# Our Platform

Welcome to the future of AI automation. Empowering over 100,000 businesses globally.

## Pricing Plans

### Basic Plan
$10/month billed monthly. Great for individuals.
- 1,000 credits
- Standard response time

### Team Plan
$50/month billed monthly. Built for fast-moving teams.
- 10,000 credits
- Collaborative workspaces

## Frequently Asked Questions
Can I cancel anytime? Yes, absolutely.

## Footer Links
- [Privacy Policy](/privacy)
- [Terms of Service](/terms)
- [Cookie Settings](#)
- [Security Notice](/security)
- [Status Page](https://status.example.com)
- Copyright 2026 Acme Corp. All rights reserved.
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.status).toBe("OPTIMIZED");
    expect(result.metrics.reductionPercentage).toBeGreaterThan(15);
    expect(result.preprocessedMarkdown).not.toContain("Skip to main content");
    expect(result.preprocessedMarkdown).not.toContain("Privacy Policy");
    expect(result.preprocessedMarkdown).not.toContain("Cookie Settings");
    expect(result.preprocessedMarkdown).toContain("Basic Plan");
    expect(result.preprocessedMarkdown).toContain("$10/month");
    expect(result.preprocessedMarkdown).toContain("Team Plan");
    expect(result.preprocessedMarkdown).toContain("$50/month");
  });

  // Scenario 3: Pricing comparison table
  it("Scenario 3: preserves markdown pricing comparison tables intact", () => {
    const markdown = `
# Plan Comparison Matrix

| Features | Free | Pro | Team | Enterprise |
| :--- | :--- | :--- | :--- | :--- |
| Monthly Price | $0 | $15/mo | $40/mo | Custom |
| API Access | No | Yes | Yes | Dedicated |
| SLA | Community | 99.9% | 99.95% | 99.99% |
| Seats | 1 | 1 | Up to 10 | Unlimited |
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.status).toBe("OPTIMIZED");
    expect(result.preservedTables.length).toBeGreaterThanOrEqual(1);
    expect(result.preprocessedMarkdown).toContain("| Features | Free | Pro | Team | Enterprise |");
    expect(result.preprocessedMarkdown).toContain("| Monthly Price | $0 | $15/mo | $40/mo | Custom |");
    expect(result.metrics.tablesPreserved).toBeGreaterThanOrEqual(1);
  });

  // Scenario 4: Feature matrix with Yes/No/Limited values
  it("Scenario 4: preserves nuanced feature availability values (Yes, No, Limited)", () => {
    const markdown = `
## Feature Comparison

| Capability | Starter ($29/mo) | Growth ($99/mo) | Enterprise ($299/mo) |
|---|---|---|---|
| Vector Search | Limited (10k vectors) | Yes (1M vectors) | Unlimited |
| Custom Models | No | No | Included |
| SSO Authentication | No | Add-on ($20/mo) | Included |
| Audit Logs | 7 days | 90 days | 365 days |
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.status).toBe("OPTIMIZED");
    expect(result.preprocessedMarkdown).toContain("Limited (10k vectors)");
    expect(result.preprocessedMarkdown).toContain("Add-on ($20/mo)");
    expect(result.preprocessedMarkdown).toContain("Audit Logs");
  });

  // Scenario 5: Monthly and annual variants
  it("Scenario 5: preserves both monthly and annual billing variants and discounts", () => {
    const markdown = `
# Subscription Tiers

### Developer
- Monthly: $12 per month
- Annual: $10 per month (billed annually as $120/yr, save 17%)
- Full CLI and API access

### Organization
- Monthly: $35 per seat / month
- Annual: $28 per seat / month (billed $336/seat/yr)
- Priority queuing and team management
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.status).toBe("OPTIMIZED");
    expect(result.preprocessedMarkdown).toContain("$12 per month");
    expect(result.preprocessedMarkdown).toContain("$10 per month");
    expect(result.preprocessedMarkdown).toContain("billed annually as $120/yr");
    expect(result.preprocessedMarkdown).toContain("$35 per seat");
    expect(result.preprocessedMarkdown).toContain("$28 per seat");
  });

  // Scenario 6: Multiple currencies and regions
  it("Scenario 6: preserves multi-currency and regional pricing symbols and figures", () => {
    const markdown = `
## Global Pricing

### European Union (EUR)
- Starter: €15/month
- Business: €45/month

### United Kingdom (GBP)
- Starter: £12/month
- Business: £38/month

### India (INR)
- Starter: ₹999/month
- Business: ₹2,999/month
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.status).toBe("OPTIMIZED");
    expect(result.preprocessedMarkdown).toContain("€15/month");
    expect(result.preprocessedMarkdown).toContain("£12/month");
    expect(result.preprocessedMarkdown).toContain("₹999/month");
  });

  // Scenario 7: Enterprise contact-sales pricing
  it("Scenario 7: captures contact sales and custom pricing tiers without dropping them", () => {
    const markdown = `
# Plans

## Self-Serve
- Free: $0 forever
- Pro: $20/month

## Enterprise
Contact Sales for bespoke deployment, dedicated VPC, custom HIPAA BAA, and tailored SLAs.
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.status).toBe("OPTIMIZED");
    expect(result.metrics.candidatePlansFound).toContain("Enterprise");
    expect(result.preprocessedMarkdown).toContain("Enterprise");
    expect(result.preprocessedMarkdown).toContain("Contact Sales");
  });

  // Scenario 8: Pricing information spread across sections
  it("Scenario 8: preserves pricing information spread across multiple distinct sections", () => {
    const markdown = `
# Product Overview

## Section A: Core Tiers
- Free Tier: 100 requests/day
- Paid Tier: $15/month for 5,000 requests/day

## Section B: Unrelated Customer Stories
Here is what our customers say... John Doe loves us.

## Section C: Add-On Capacities
- Additional 1,000 requests: $2/month
- Dedicated IP Address: $10/month
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.status).toBe("OPTIMIZED");
    expect(result.preprocessedMarkdown).toContain("Free Tier");
    expect(result.preprocessedMarkdown).toContain("Paid Tier");
    expect(result.preprocessedMarkdown).toContain("Additional 1,000 requests: $2/month");
  });

  // Scenario 9: Separate pricing and feature URLs / sections
  it("Scenario 9: retains feature detail sections that explain tier capabilities", () => {
    const markdown = `
# Pricing & Specifications

## Plan Summary
- Lite: $5/month
- Plus: $15/month

## Detailed Feature Specifications
Lite includes single-user mode and community support.
Plus unlocks collaboration, 5 workspaces, and webhooks integration.
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.status).toBe("OPTIMIZED");
    expect(result.preprocessedMarkdown).toContain("Lite: $5/month");
    expect(result.preprocessedMarkdown).toContain("Plus unlocks collaboration");
  });

  // Scenario 10: Page with no pricing information
  it("Scenario 10: correctly classifies pages with no pricing content as NO_PRICING_CONTENT", () => {
    const markdown = `
# About Our Company
Founded in 2021, we build open-source robotics software for warehouse automation.
Our team consists of researchers, roboticists, and engineers from around the world.
We believe in open innovation and ethical AI.
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.status).toBe("NO_PRICING_CONTENT");
    expect(result.metrics.candidatePricesFound).toBe(0);
    expect(result.metrics.candidatePlansFound.length).toBe(0);
  });

  // Scenario 11: Page where the filter detects nothing relevant (triggers fallback)
  it("Scenario 11: falls back safely to full cleaned content if initial filter yields zero relevant sections", () => {
    // Content has price clues embedded inside ambiguous paragraphs without standard pricing headings
    const markdown = `
Some introduction without headers.
Here is the cost breakdown: license fee is $45 annually.
Support is available 24/7.
    `;

    const result = preprocessMarkdownForExtraction(markdown);
    expect(result.preprocessedMarkdown).toContain("$45 annually");
    expect(result.preprocessedMarkdown.length).toBeGreaterThan(0);
  });

  // Scenario 12: Large page requiring multiple chunks
  it("Scenario 12: integrates cleanly with semantic chunker when document exceeds single token budget", () => {
    const sections = [];
    for (let i = 1; i <= 20; i++) {
      sections.push(`
## Tier ${i} Plan
- Price: $${i * 10}/month
- Includes ${i * 1000} API credits
- Feature Set Alpha
- Feature Set Beta
- Feature Set Gamma
      `);
    }
    const longMarkdown = `# Mega Pricing Catalog\n` + sections.join("\n\n");

    const preprocessed = preprocessMarkdownForExtraction(longMarkdown);
    const budget = getModelTokenBudget("qwen/qwen3.8-27b");
    const chunks = chunkMarkdownForExtraction(preprocessed.preprocessedMarkdown, budget);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    chunks.forEach((chunk) => {
      expect(chunk.estimatedTokens).toBeLessThanOrEqual(budget.maxChunkInputTokens + 50);
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });

  // Scenario 13: Table preservation across chunk boundaries
  it("Scenario 13: chunker preserves markdown table headers when slicing large tables", () => {
    const rows = [];
    for (let i = 1; i <= 100; i++) {
      rows.push(`| Feature Metric ${i} | Tier A Included | Tier B Tier ${i} | Tier C Custom |`);
    }
    const tableMarkdown = `
# Huge Comparison Table

| Metric | Plan A ($10/mo) | Plan B ($50/mo) | Plan C ($200/mo) |
|---|---|---|---|
${rows.join("\n")}
    `;

    const smallBudget: ModelTokenBudget = {
      modelName: "test-model",
      maxContextTokens: 2000,
      inputTokenPerMinuteLimit: 7000,
      systemPromptBudgetTokens: 200,
      safetyMarginTokens: 100,
      maxChunkInputTokens: 300, // force chunking within table
      responseTokensReserved: 500,
    };

    const chunks = chunkMarkdownForExtraction(tableMarkdown, smallBudget);
    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk following a split table should maintain the header row
    for (let c = 1; c < chunks.length; c++) {
      expect(chunks[c].content).toContain("| Metric | Plan A ($10/mo) | Plan B ($50/mo) | Plan C ($200/mo) |");
    }
  });

  // Scenario 14: Preprocessing fallback when confidence is low
  it("Scenario 14: triggers quality guard fallback if tables or prices are in jeopardy", () => {
    const rawMarkdown = `
## Ambiguous Header
| Plan | Cost |
| Free | $0 |
| Paid | $25 |
Random unclassified text here that might confuse aggressive filters.
    `;

    const result = preprocessMarkdownForExtraction(rawMarkdown);
    // Even under ambiguous headings, table and prices must be preserved
    expect(result.preprocessedMarkdown).toContain("| Free | $0 |");
    expect(result.preprocessedMarkdown).toContain("| Paid | $25 |");
  });

  // Scenario 15: Ensuring all source-supported plans survive preprocessing
  it("Scenario 15: preserves all distinct plans (e.g. Copilot 6 plans: Free, Pro, Pro+, Max, Business, Enterprise)", () => {
    const copilotPricingMarkdown = `
# Microsoft Copilot Plans & Pricing

### Copilot Free
- $0 per month
- Web-grounded chat and basic image creation

### Copilot Pro
- $20 per user / month
- Priority access to GPT-4o, Copilot in Word, Excel, PowerPoint

### Copilot Pro Plus
- $35 per user / month
- Expanded compute and higher image resolution quotas

### Copilot Max
- $100 per user / month
- Dedicated GPU burst instances and agent studio

### Copilot for Microsoft 365 Business
- $30 per user / month (annual commitment)
- Enterprise-grade data protection and Microsoft Graph grounding

### Copilot Enterprise
- Contact sales for custom tenant licensing and sovereign cloud deployments
    `;

    const result = preprocessMarkdownForExtraction(copilotPricingMarkdown);
    expect(result.status).toBe("OPTIMIZED");
    expect(result.metrics.candidatePlansFound.length).toBeGreaterThanOrEqual(6);
    expect(result.preprocessedMarkdown).toContain("Copilot Free");
    expect(result.preprocessedMarkdown).toContain("Copilot Pro");
    expect(result.preprocessedMarkdown).toContain("Copilot Pro Plus");
    expect(result.preprocessedMarkdown).toContain("Copilot Max");
    expect(result.preprocessedMarkdown).toContain("Copilot for Microsoft 365 Business");
    expect(result.preprocessedMarkdown).toContain("Copilot Enterprise");
  });
});
