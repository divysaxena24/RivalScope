import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiResponse, ApiErrorResponse, PaginationMeta } from "@/types/api-contracts";

/**
 * Standard Success Response Helper
 */
export function successResponse<T, F = Record<string, unknown>>(
  data: T,
  options?: {
    pagination?: PaginationMeta;
    filters?: F;
    status?: number;
  }
): NextResponse<ApiResponse<T, F>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(options?.pagination ? { pagination: options.pagination } : {}),
      ...(options?.filters ? { filters: options.filters } : {}),
    },
    { status: options?.status || 200 }
  );
}

/**
 * Standard Error Response Helper
 */
export function errorResponse(
  message: string,
  code: string = "INTERNAL_ERROR",
  status: number = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

/**
 * Standard Handler for API Route Exceptions
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  console.error("API Error caught:", error);

  if (error instanceof ZodError) {
    return errorResponse(
      "Validation failed for query parameters or request body",
      "VALIDATION_ERROR",
      400,
      error.flatten()
    );
  }

  if (error && typeof error === "object") {
    const err = error as any;
    if (err.code === "NOT_FOUND" || err.status === 404) {
      return errorResponse(err.message || "Resource not found", "NOT_FOUND", 404);
    }
    if (err.status && typeof err.status === "number") {
      return errorResponse(err.message || "Request failed", err.code || "REQUEST_FAILED", err.status);
    }
  }

  const message = error instanceof Error ? error.message : "An unexpected server error occurred";
  return errorResponse(message, "INTERNAL_SERVER_ERROR", 500);
}
