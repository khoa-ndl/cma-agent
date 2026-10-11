import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getAccessCodeStatus } from "@/lib/credits/access";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "../../api/_lib/session";
import { NewCmaForm } from "../../_components/NewCmaForm";

// Session- and balance-gated on every load; see page.tsx's note on why
// this opts out of instant-navigation validation instead of streaming.
export const instant = false;

export default async function NewCmaPage() {
  // See cma/[id]/page.tsx's note: closes a gap where Next's prerendering
  // pass trips on verifySessionToken()'s Date.now() before cookies() alone
  // would mark the route dynamic.
  await connection();
  const cookieStore = await cookies();
  const accessCodeId = resolveAccessCodeId(cookieStore.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  if (!accessCodeId) {
    redirect("/");
  }

  const status = await getAccessCodeStatus(getDb(), accessCodeId);
  if (!status || status.revoked) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-4 py-16">
      <h1 className="text-2xl font-semibold text-(--color-foreground)">New comparative market analysis</h1>
      <NewCmaForm creditsBalance={status.creditsBalance} />
    </main>
  );
}
