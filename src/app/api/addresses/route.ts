import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { isAdminSession } from "../_lib/admin-session";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "../_lib/session";
import { handleAddressesRequest } from "./logic";

// Shared by both the end-user and admin "New CMA" forms (both mount
// AddressAutocomplete), so either session type counts as authenticated.
export async function GET(request: NextRequest) {
  const accessCodeId = resolveAccessCodeId(request.cookies.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  const isAdmin = isAdminSession(request.cookies);
  const query = request.nextUrl.searchParams.get("q") ?? "";

  const provider = createSampleDataProvider(getDb());
  const result = await handleAddressesRequest(provider, query, Boolean(accessCodeId) || isAdmin);
  return NextResponse.json(result.body, { status: result.status });
}
