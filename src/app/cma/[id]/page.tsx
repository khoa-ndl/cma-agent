import { connection } from "next/server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getReport } from "@/app/api/reports/[id]/logic";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "../../api/_lib/session";
import { ReportView, type ReportBody } from "../../_components/ReportView";

// Session- and ownership-gated on every load; see page.tsx's note on why
// this opts out of instant-navigation validation instead of streaming.
export const instant = false;

export default async function ReportPage(props: PageProps<"/cma/[id]">) {
  // cookies() alone should mark this dynamic, but Next's prerendering pass
  // was still tripping on verifySessionToken()'s Date.now() call before it
  // got there ("Next.js encountered the unstable value Date.now() while
  // prerendering" in the dev log) — connection() forces request-time
  // rendering from the first line, closing that gap.
  await connection();
  const { id } = await props.params;
  const cookieStore = await cookies();
  const accessCodeId = resolveAccessCodeId(cookieStore.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  if (!accessCodeId) {
    redirect("/");
  }

  const result = await getReport(getDb(), id, accessCodeId);
  if (result.status === 404) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-4 py-16">
      <ReportView reportId={id} initial={result.body as ReportBody} />
    </main>
  );
}
