import { describe, it, expect } from "vitest";

export function formatSidebarCompetitorCount(
  count: number | null,
  isLoading: boolean
): string {
  if (isLoading) return "Loading...";
  if (count === null) return "Database offline";
  if (count === 0) return "0 monitored competitors";
  if (count === 1) return "1 monitored competitor";
  return `${count} monitored competitors`;
}

describe("Sidebar Dynamic Competitor Count Logic", () => {
  it("should format loading state properly", () => {
    expect(formatSidebarCompetitorCount(null, true)).toBe("Loading...");
    expect(formatSidebarCompetitorCount(5, true)).toBe("Loading...");
  });

  it("should handle offline/null error state properly", () => {
    expect(formatSidebarCompetitorCount(null, false)).toBe("Database offline");
  });

  it("should format 0 competitors without inventing artificial plan limits", () => {
    const formatted = formatSidebarCompetitorCount(0, false);
    expect(formatted).toBe("0 monitored competitors");
    expect(formatted).not.toContain("/ 10");
    expect(formatted).not.toContain("Workspace Free");
  });

  it("should format singular competitor count properly", () => {
    expect(formatSidebarCompetitorCount(1, false)).toBe("1 monitored competitor");
  });

  it("should format multiple competitors dynamically from database counts", () => {
    expect(formatSidebarCompetitorCount(4, false)).toBe("4 monitored competitors");
    expect(formatSidebarCompetitorCount(12, false)).toBe("12 monitored competitors");
    expect(formatSidebarCompetitorCount(45, false)).toBe("45 monitored competitors");
  });
});
