import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { isAdminSession } from "../../_lib/admin-session";
import { getAdminOverview } from "./logic";

export async function GET(request: NextRequest) {
  const isAdmin = isAdminSession(request.cookies);
  const result = await getAdminOverview(getDb(), isAdmin);
  return NextResponse.json(result.body, { status: result.status });
}
