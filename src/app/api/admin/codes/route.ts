import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { isAdminSession } from "../../_lib/admin-session";
import { handleIssueCode, listAdminCodes } from "./logic";

export async function GET(request: NextRequest) {
  const isAdmin = isAdminSession(request.cookies);
  const result = await listAdminCodes(getDb(), isAdmin);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const isAdmin = isAdminSession(request.cookies);
  const body = await request.json().catch(() => null);

  const result = await handleIssueCode(getDb(), body, isAdmin);
  return NextResponse.json(result.body, { status: result.status });
}
