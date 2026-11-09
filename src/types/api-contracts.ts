import { z } from "zod";

/**
 * Standard Pagination Request Schema
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Standard Pagination Metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/**
 * Standard API Success Response Shape
 */
export interface ApiResponse<T, F = Record<string, unknown>> {
  success: boolean;
  data: T;
  pagination?: PaginationMeta;
  filters?: F;
}

/**
 * Standard API Error Response Shape
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Helper to compute pagination metadata
 */
export function buildPaginationMeta(
  totalRecords: number,
  page: number,
  pageSize: number
): PaginationMeta {
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  return {
    page,
    pageSize,
    totalRecords,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}
