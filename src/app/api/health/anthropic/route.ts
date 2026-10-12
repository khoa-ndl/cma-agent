import { NextResponse, connection } from "next/server";
import { checkAnthropicHealth } from "./logic";

export async function GET() {
  // Same reasoning as /api/health: nothing here has a sensible static
  // shell, so this opts into request-time rendering explicitly.
  await connection();
  const result = await checkAnthropicHealth();
  return NextResponse.json(result.body, { status: result.status });
}
