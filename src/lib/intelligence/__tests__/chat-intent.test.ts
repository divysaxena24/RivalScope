import { describe, it, expect } from "vitest";
import {
  classifyQueryScope,
  normalizeChatError,
  OUT_OF_SCOPE_FRIENDLY_MESSAGE,
  INSUFFICIENT_DATA_FRIENDLY_MESSAGE,
} from "../chat-intent";

describe("Competitor Intelligence Chat Intent & Error Normalization Tests", () => {
  const trackedCompetitors = ["ChatGPT", "Claude", "Gemini", "Perplexity"];

  describe("1. Out-of-Scope Query Filtering", () => {
    it("classifies general knowledge questions as out of scope", () => {
      const res1 = classifyQueryScope("Who is the Prime Minister of India?", trackedCompetitors);
      expect(res1.inScope).toBe(false);

      const res2 = classifyQueryScope("Who is the president of the United States?", trackedCompetitors);
      expect(res2.inScope).toBe(false);
    });

    it("classifies geography questions as out of scope", () => {
      const res1 = classifyQueryScope("Where is Kashmir?", trackedCompetitors);
      expect(res1.inScope).toBe(false);

      const res2 = classifyQueryScope("What is the capital of Japan?", trackedCompetitors);
      expect(res2.inScope).toBe(false);
    });

    it("classifies unrelated creative writing and coding questions as out of scope", () => {
      const res1 = classifyQueryScope("Write me a poem about raindrops", trackedCompetitors);
      expect(res1.inScope).toBe(false);

      const res2 = classifyQueryScope("Solve this unrelated coding problem in Python", trackedCompetitors);
      expect(res2.inScope).toBe(false);

      const res3 = classifyQueryScope("Reverse a linked list algorithm", trackedCompetitors);
      expect(res3.inScope).toBe(false);
    });
  });

  describe("2. Preserving Relevant Competitive Intelligence Questions", () => {
    it("preserves competitor pricing questions", () => {
      const queries = [
        "What is the latest pricing?",
        "What is the price of Claude Pro?",
        "How much does ChatGPT Plus cost monthly?",
        "Show me Gemini's subscription tiers",
      ];

      for (const q of queries) {
        const res = classifyQueryScope(q, trackedCompetitors);
        expect(res.inScope, `Expected "${q}" to be inScope`).toBe(true);
      }
    });

    it("preserves feature and quota questions", () => {
      const queries = [
        "Which plan offers the most features?",
        "What are the usage limits for the Ultra tier?",
        "What changed in the competitor's pricing?",
      ];

      for (const q of queries) {
        const res = classifyQueryScope(q, trackedCompetitors);
        expect(res.inScope, `Expected "${q}" to be inScope`).toBe(true);
      }
    });

    it("preserves competitor comparison and strategic questions", () => {
      const queries = [
        "How does this competitor compare with its alternatives?",
        "What are its strengths and weaknesses?",
        "What opportunities can we identify?",
        "Compare Claude vs ChatGPT",
      ];

      for (const q of queries) {
        const res = classifyQueryScope(q, trackedCompetitors);
        expect(res.inScope, `Expected "${q}" to be inScope`).toBe(true);
      }
    });

    it("allows queries that explicitly mention a tracked competitor name", () => {
      const res = classifyQueryScope("Tell me everything about Claude", trackedCompetitors);
      expect(res.inScope).toBe(true);
    });
  });

  describe("3. Friendly Fallback Messages", () => {
    it("provides the specified friendly message for out-of-scope inquiries", () => {
      expect(OUT_OF_SCOPE_FRIENDLY_MESSAGE).toBe(
        "I'm designed to help with competitive intelligence, including competitor pricing, features, product comparisons, market positioning, and historical changes. This question is outside my scope. Try asking me something about your selected competitor!"
      );
    });

    it("provides the specified friendly message for insufficient competitor data", () => {
      expect(INSUFFICIENT_DATA_FRIENDLY_MESSAGE).toBe(
        "I couldn't find enough information in the available competitor data to answer this reliably. Try refreshing the competitor's tracked pages or asking about information currently available in its profile."
      );
    });
  });

  describe("4. Safe Error Normalization & Prevention of [object Object]", () => {
    it("handles Groq rate limit errors (429 / TPM)", () => {
      const groqError = new Error("429 Too Many Requests: Rate limit exceeded for model on tokens per minute (TPM)");
      const normalized = normalizeChatError(groqError);

      expect(normalized.code).toBe("RATE_LIMITED");
      expect(normalized.statusCode).toBe(429);
      expect(normalized.friendlyMessage).toContain("experiencing high demand");
      expect(normalized.friendlyMessage).not.toContain("[object Object]");
      expect(normalized.friendlyMessage).not.toContain("429");
    });

    it("handles database connection failures safely without exposing credentials", () => {
      const dbError = new Error("NeonDbError: connection terminated unexpectedly fetching from drizzle");
      const normalized = normalizeChatError(dbError);

      expect(normalized.code).toBe("DATABASE_ERROR");
      expect(normalized.statusCode).toBe(503);
      expect(normalized.friendlyMessage).toContain("temporary issue accessing your competitive data records");
      expect(normalized.friendlyMessage).not.toContain("NeonDbError");
      expect(normalized.friendlyMessage).not.toContain("[object Object]");
    });

    it("handles raw API response objects without rendering [object Object]", () => {
      const rawApiObj = {
        status: 502,
        error: "Bad Gateway from Groq endpoint",
        details: { code: "SERVER_ERROR", traceId: "abc-123" },
      };

      const normalized = normalizeChatError(rawApiObj);
      expect(normalized.code).toBe("PROVIDER_ERROR");
      expect(normalized.friendlyMessage).not.toContain("[object Object]");
      expect(normalized.friendlyMessage).not.toContain("traceId");
    });

    it("handles completely arbitrary or unidentifiable error objects cleanly", () => {
      const weirdObj = { someRandomProp: 12345, nested: { foo: "bar" } };
      const normalized = normalizeChatError(weirdObj);

      expect(normalized.code).toBe("UNKNOWN_ERROR");
      expect(normalized.friendlyMessage).not.toContain("[object Object]");
      expect(normalized.friendlyMessage).toContain("unable to complete your analysis right now");
    });

    it("handles null and undefined errors cleanly", () => {
      const normNull = normalizeChatError(null);
      const normUndef = normalizeChatError(undefined);

      expect(normNull.friendlyMessage).not.toContain("[object Object]");
      expect(normUndef.friendlyMessage).not.toContain("[object Object]");
    });
  });
});
