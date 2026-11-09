import { NextRequest, NextResponse } from "next/server";
import { runMarketWideInsightsPipeline } from "@/lib/intelligence/insight-pipeline";

export async function POST(req: NextRequest) {
  try {
    const result = await runMarketWideInsightsPipeline();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error generating market-wide insights:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to generate market insights",
        code: error.code || "INTERNAL_ERROR",
      },
      { status: error.status || 500 }
    );
  }
}
