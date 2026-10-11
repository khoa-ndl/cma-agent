import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getAccessCodeStatus } from "@/lib/credits/access";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "./api/_lib/session";
import { AccessForm } from "./_components/AccessForm";

// Reads the session cookie on every load (to redirect an already-signed-in
// visitor straight to /cma/new) — nothing here has a sensible static
// shell to prerender ahead of that check, so this opts out of Cache
// Components' instant-navigation validation rather than fake a boundary.
export const instant = false;

export default async function HomePage() {
  // See cma/[id]/page.tsx's note: closes a gap where Next's prerendering
  // pass trips on verifySessionToken()'s Date.now() before cookies() alone
  // would mark the route dynamic.
  await connection();
  const cookieStore = await cookies();
  const accessCodeId = resolveAccessCodeId(cookieStore.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  if (accessCodeId) {
    // Checks the code is still active, not just that the cookie's
    // signature is valid — a signed cookie stays valid for 30 days
    // regardless of revocation, and /cma/new redirects back here for a
    // revoked code. Redirecting on token validity alone would bounce
    // between the two routes forever for a revoked code's lingering
    // cookie (A10).
    const status = await getAccessCodeStatus(getDb(), accessCodeId);
    if (status && !status.revoked) {
      redirect("/cma");
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
      <div className="flex max-w-md flex-col gap-3 text-center">
        <h1 className="text-2xl font-semibold text-(--color-foreground)">CMA Agent</h1>
        <p className="text-base text-(--color-muted-foreground)">
          An AI agent that researches comparable sales and produces a comparative market analysis — pricing
          range, adjustment grid and rationale — from a sample real-estate dataset. Enter your access code to
          start.
        </p>
      </div>
      <AccessForm />
    </main>
  );
}
