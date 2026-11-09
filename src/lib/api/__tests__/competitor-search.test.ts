import { describe, it, expect, vi } from "vitest";

export interface SearchFilterArgs {
  query: string;
  minChars?: number;
  limit?: number;
}

export function filterCompetitorsLocally(
  items: Array<{ id: string; name: string; domain: string }>,
  args: SearchFilterArgs
) {
  const minChars = args.minChars ?? 2;
  const limit = args.limit ?? 5;
  const trimmed = args.query.trim().toLowerCase();

  if (trimmed.length < minChars) {
    return { shouldQuery: false, results: [] };
  }

  const results = items
    .filter(
      (item) =>
        item.name.toLowerCase().includes(trimmed) ||
        item.domain.toLowerCase().includes(trimmed)
    )
    .slice(0, limit);

  return { shouldQuery: true, results };
}

describe("Global Competitor Search Logic & Keyboard Navigation", () => {
  const mockDataset = [
    { id: "c1", name: "ChatGPT", domain: "chatgpt.com" },
    { id: "c2", name: "Claude AI", domain: "anthropic.com" },
    { id: "c3", name: "Linear", domain: "linear.app" },
    { id: "c4", name: "Cursor", domain: "cursor.com" },
    { id: "c5", name: "Copilot", domain: "github.com" },
    { id: "c6", name: "Cohere", domain: "cohere.com" },
  ];

  it("should ignore queries shorter than 2 characters", () => {
    const emptyResult = filterCompetitorsLocally(mockDataset, { query: "" });
    expect(emptyResult.shouldQuery).toBe(false);
    expect(emptyResult.results).toHaveLength(0);

    const singleChar = filterCompetitorsLocally(mockDataset, { query: "c" });
    expect(singleChar.shouldQuery).toBe(false);
    expect(singleChar.results).toHaveLength(0);
  });

  it("should match competitors by name and domain when query >= 2 chars", () => {
    const res = filterCompetitorsLocally(mockDataset, { query: "chat" });
    expect(res.shouldQuery).toBe(true);
    expect(res.results).toHaveLength(1);
    expect(res.results[0].name).toBe("ChatGPT");

    const domainRes = filterCompetitorsLocally(mockDataset, { query: "linear.app" });
    expect(domainRes.results).toHaveLength(1);
    expect(domainRes.results[0].name).toBe("Linear");
  });

  it("should limit search results to 5 matches maximum", () => {
    // 'c' prefix matches ChatGPT, Claude AI, Cursor, Copilot, Cohere (5 items)
    const res = filterCompetitorsLocally(mockDataset, { query: "co" });
    expect(res.results.length).toBeLessThanOrEqual(5);
  });

  it("should return empty list when no competitors match", () => {
    const res = filterCompetitorsLocally(mockDataset, { query: "nonexistent company" });
    expect(res.shouldQuery).toBe(true);
    expect(res.results).toHaveLength(0);
  });

  it("should correctly calculate keyboard navigation cyclic index", () => {
    const listLength = 3;
    let selectedIndex = -1;

    // Arrow down from -1 -> 0
    selectedIndex = selectedIndex < listLength - 1 ? selectedIndex + 1 : 0;
    expect(selectedIndex).toBe(0);

    // Arrow down from 0 -> 1
    selectedIndex = selectedIndex < listLength - 1 ? selectedIndex + 1 : 0;
    expect(selectedIndex).toBe(1);

    // Arrow down from 1 -> 2
    selectedIndex = selectedIndex < listLength - 1 ? selectedIndex + 1 : 0;
    expect(selectedIndex).toBe(2);

    // Arrow down from 2 (last) wraps to 0
    selectedIndex = selectedIndex < listLength - 1 ? selectedIndex + 1 : 0;
    expect(selectedIndex).toBe(0);

    // Arrow up from 0 wraps to 2
    selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : listLength - 1;
    expect(selectedIndex).toBe(2);
  });
});
