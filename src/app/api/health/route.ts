import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { checkHealth } from "./logic";

export async function GET() {
  const result = await checkHealth(getDb());
  return NextResponse.json(result.body, { status: result.status });
}
