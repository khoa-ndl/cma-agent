import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getAccessCodeStatus } from "@/lib/credits/access";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "./api/_lib/session";
import { AccessForm } from "./_components/AccessForm";

// Reads the session cookie on every load (to redirect an already-signed-in
// visitor straight to /cma) — nothing here has a sensible static
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
    // signature is valid — a signed cookie stays valid for the full
    // 90-minute idle window regardless of revocation (operator-dashboard
    // spec.md D11), and every gated /cma/* page redirects back here for a
    // revoked code. Redirecting on token validity alone would bounce
    // between here and there forever for a revoked code's lingering
    // cookie (A10).
    const status = await getAccessCodeStatus(getDb(), accessCodeId);
    if (status && !status.revoked) {
      redirect("/cma");
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-(--color-border) px-12 py-6">
        <span className="font-heading text-xl font-bold text-(--color-primary)">CMA Agent</span>
      </header>

      <div className="flex flex-1 flex-wrap">
        <div className="flex min-w-[420px] flex-1 flex-col justify-center gap-9 px-16 py-20">
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold tracking-wider text-(--color-primary) uppercase">
              AI Comparative Market Analysis
            </span>
            <h1 className="font-heading text-4xl leading-tight font-bold text-(--color-foreground)">
              Know what a home is worth, backed by the comps.
            </h1>
            <p className="max-w-md text-base text-(--color-muted-foreground)">
              An AI agent that researches comparable sales and produces a comparative market analysis — pricing
              range, adjustment grid and rationale — from a sample real-estate dataset. Enter your access code to
              start.
            </p>
          </div>

          <div className="flex flex-wrap gap-7">
            {["Comparable sales search", "Adjustment grid + rationale", "Branded PDF export"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="var(--color-primary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm font-medium text-(--color-foreground)">{item}</span>
              </div>
            ))}
          </div>

          <AccessForm />
        </div>

        <div className="relative min-w-[360px] flex-1 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- static marketing chrome, not a Next/Image-managed asset pipeline target */}
          <img
            src="/images/properties/single-family-2.jpg"
            alt="A representative single-family home from the sample dataset"
            className="h-full w-full min-h-[420px] object-cover"
          />
          <div className="absolute bottom-4 left-4 rounded-md bg-(--color-primary)/85 px-3 py-1.5 text-xs text-(--color-on-primary)">
            Representative image — sample dataset
          </div>
        </div>
      </div>
    </main>
  );
}
