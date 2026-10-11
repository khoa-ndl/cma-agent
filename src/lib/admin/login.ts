// Admin password check (operator-dashboard spec.md, Decisions and §5):
// ADMIN_PASSWORD is a single shared secret, compared in constant time,
// never hashed -- it's a single operator credential set directly as a
// Vercel env var, not a user-chosen password with many holders. Rate
// limiting uses its own table (adminLoginAttempts) and the same
// threshold constants lib/credits/access.ts exports, but a separate
// query, so hammering one login surface can't lock out the other's
// budget for a shared IP (D10).
import { timingSafeEqual } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { adminLoginAttempts } from "@/lib/db/schema";
import { MAX_FAILED_ATTEMPTS, RATE_LIMIT_WINDOW_MINUTES } from "@/lib/credits/access";

export interface AdminLoginResult {
  ok: boolean;
  reason?: "invalid" | "rate_limited";
}

async function isRateLimited(db: Database, ipAddress: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const recent = await db
    .select({ id: adminLoginAttempts.id })
    .from(adminLoginAttempts)
    .where(
      and(
        eq(adminLoginAttempts.ipAddress, ipAddress),
        eq(adminLoginAttempts.succeeded, false),
        gte(adminLoginAttempts.createdAt, cutoff),
      ),
    )
    .limit(MAX_FAILED_ATTEMPTS);
  return recent.length >= MAX_FAILED_ATTEMPTS;
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  // timingSafeEqual throws on mismatched lengths, so that case is
  // checked first -- it's not a secret-dependent branch here, since
  // ADMIN_PASSWORD's length isn't itself sensitive the way its content is.
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

/** Checks a submitted password, recording the attempt either way. Rate
 * limiting is checked first, before the password comparison, so a
 * locked-out IP can't use repeated guesses to fish for anything. */
export async function checkAdminLogin(
  db: Database,
  submittedPassword: string,
  ipAddress: string,
  correctPassword: string,
): Promise<AdminLoginResult> {
  if (await isRateLimited(db, ipAddress)) {
    return { ok: false, reason: "rate_limited" };
  }

  const ok = constantTimeEquals(submittedPassword, correctPassword);
  await db.insert(adminLoginAttempts).values({ ipAddress, succeeded: ok });

  return ok ? { ok: true } : { ok: false, reason: "invalid" };
}
