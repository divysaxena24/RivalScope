import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 }
    );
  }

  // Check for PostgreSQL unique constraint violation (code 23505)
  const pgErr = err as { code?: string; detail?: string; message?: string };
  if (pgErr?.code === "23505") {
    return NextResponse.json(
      {
        success: false,
        error: "A record with this identifier or domain already exists.",
      },
      { status: 409 }
    );
  }

  console.error("Internal API error:", err instanceof Error ? err.message : err);

  return NextResponse.json(
    {
      success: false,
      error: "An unexpected internal server error occurred.",
    },
    { status: 500 }
  );
}
