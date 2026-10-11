import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { SESSION_COOKIE_NAME, resolveAccessCodeId } from "../_lib/session";
import { handleAddressesRequest } from "./logic";

export async function GET(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Copy .env.example to .env and fill in a value.");
  }
  const accessCodeId = resolveAccessCodeId(request.cookies.get(SESSION_COOKIE_NAME)?.value, secret);
  const query = request.nextUrl.searchParams.get("q") ?? "";

  const provider = createSampleDataProvider(getDb());
  const result = await handleAddressesRequest(provider, query, accessCodeId);
  return NextResponse.json(result.body, { status: result.status });
}
