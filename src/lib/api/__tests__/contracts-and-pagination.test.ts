import { describe, it, expect } from "vitest";
import { PaginationQuerySchema, buildPaginationMeta } from "../../../types/api-contracts";

describe("Dashboard API Contracts & Pagination Logic", () => {
  it("should parse valid pagination query parameters", () => {
    const parsed = PaginationQuerySchema.parse({
      page: "2",
      pageSize: "25",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(25);
  });

  it("should apply default pagination when params are missing", () => {
    const parsed = PaginationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it("should reject negative or zero page values", () => {
    expect(() => PaginationQuerySchema.parse({ page: "0" })).toThrow();
    expect(() => PaginationQuerySchema.parse({ page: "-5" })).toThrow();
  });

  it("should reject page size greater than 100", () => {
    expect(() => PaginationQuerySchema.parse({ pageSize: "101" })).toThrow();
  });

  it("should correctly calculate pagination metadata for middle page", () => {
    const meta = buildPaginationMeta(95, 2, 20);
    expect(meta.totalRecords).toBe(95);
    expect(meta.totalPages).toBe(5);
    expect(meta.page).toBe(2);
    expect(meta.hasPreviousPage).toBe(true);
    expect(meta.hasNextPage).toBe(true);
  });

  it("should correctly calculate pagination metadata for first page", () => {
    const meta = buildPaginationMeta(40, 1, 20);
    expect(meta.hasPreviousPage).toBe(false);
    expect(meta.hasNextPage).toBe(true);
  });

  it("should correctly calculate pagination metadata for last page", () => {
    const meta = buildPaginationMeta(40, 2, 20);
    expect(meta.hasPreviousPage).toBe(true);
    expect(meta.hasNextPage).toBe(false);
  });

  it("should handle empty datasets without division by zero or negative pages", () => {
    const meta = buildPaginationMeta(0, 1, 20);
    expect(meta.totalRecords).toBe(0);
    expect(meta.totalPages).toBe(1);
    expect(meta.hasPreviousPage).toBe(false);
    expect(meta.hasNextPage).toBe(false);
  });
});
