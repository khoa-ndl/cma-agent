import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "../_lib/session";
import { handleAddressesRequest } from "./logic";

export async function GET(request: NextRequest) {
  const accessCodeId = resolveAccessCodeId(request.cookies.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  const query = request.nextUrl.searchParams.get("q") ?? "";

  const provider = createSampleDataProvider(getDb());
  const result = await handleAddressesRequest(provider, query, accessCodeId);
  return NextResponse.json(result.body, { status: result.status });
}
