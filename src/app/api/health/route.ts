import { NextResponse, connection } from "next/server";
import { getDb } from "@/lib/db/client";
import { checkHealth } from "./logic";

export async function GET() {
  // This must run a real query on every request (that's the point of a
  // health check), not be prerendered into a static response at build
  // time — Cache Components would otherwise try to, since this route
  // touches no other request-time API.
  await connection();
  const result = await checkHealth(getDb());
  return NextResponse.json(result.body, { status: result.status });
}
