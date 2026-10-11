// Access codes: random, high-entropy, stored hashed (spec 6, 8). SHA-256
// is sufficient here — unlike a user-chosen password, a 128-bit random
// code has no low-entropy guesses to resist, so a slow password-hashing
// algorithm (bcrypt/argon2) would add a dependency for no real benefit.
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gte, ne } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { accessAttempts, accessCodes } from "@/lib/db/schema";

// The reserved system code for unmetered operator reports
// (operator-dashboard spec.md §3) -- excluded from every customer-facing
// query below, and from lib/credits/operator.ts's own queries.
export const OPERATOR_CODE_LABEL = "__operator__";

const CODE_BYTES = 16; // 128 bits of entropy
const GROUP_SIZE = 4;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// Exported so the admin login's own rate limiter (operator-dashboard
// spec.md) uses the same threshold without redeclaring it.
export const MAX_FAILED_ATTEMPTS = 10;
export const RATE_LIMIT_WINDOW_MINUTES = 15;

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** A new plain-text access code, grouped for readability (e.g. when read
 * aloud or typed). It is never stored — only its hash is. */
export function generateAccessCode(): string {
  const raw = base32Encode(randomBytes(CODE_BYTES));
  const groups: string[] = [];
  for (let i = 0; i < raw.length; i += GROUP_SIZE) {
    groups.push(raw.slice(i, i + GROUP_SIZE));
  }
  return groups.join("-");
}

/** Normalizes formatting (dashes, case) before hashing, so a code typed
 * without dashes or in a different case still matches what was stored. */
export function hashAccessCode(code: string): string {
  const normalized = code.replace(/-/g, "").toUpperCase();
  return createHash("sha256").update(normalized).digest("hex");
}

export interface AccessCheckResult {
  ok: boolean;
  accessCodeId?: string;
  creditsBalance?: number;
  reason?: "invalid" | "revoked" | "rate_limited";
}

// Counting recent failures and recording this attempt happen as two
// separate steps, not one atomic check-and-write — a burst of parallel
// requests from one IP could get a few extra lookups through before
// their own failures are recorded. That's an accepted, bounded gap: a
// 128-bit code can't be sped up by request volume, so this only bounds
// how many wasted lookups get through before throttling catches up, not
// how guessable a code is.
async function isRateLimited(db: Database, ipAddress: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const recent = await db
    .select({ id: accessAttempts.id })
    .from(accessAttempts)
    .where(
      and(
        eq(accessAttempts.ipAddress, ipAddress),
        eq(accessAttempts.succeeded, false),
        gte(accessAttempts.createdAt, cutoff),
      ),
    )
    .limit(MAX_FAILED_ATTEMPTS);
  return recent.length >= MAX_FAILED_ATTEMPTS;
}

/** Checks a submitted code, recording the attempt either way. Rate
 * limiting is checked first, before any database lookup of the code
 * itself, so a locked-out IP can't use repeated guesses to fish for
 * information about which codes exist. */
export async function checkAccessCode(
  db: Database,
  code: string,
  ipAddress: string,
): Promise<AccessCheckResult> {
  if (await isRateLimited(db, ipAddress)) {
    return { ok: false, reason: "rate_limited" };
  }

  const codeHash = hashAccessCode(code);
  const [record] = await db.select().from(accessCodes).where(eq(accessCodes.codeHash, codeHash)).limit(1);
  const ok = Boolean(record && !record.revokedAt);

  await db.insert(accessAttempts).values({ ipAddress, succeeded: ok });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.revokedAt) return { ok: false, reason: "revoked" };
  return { ok: true, accessCodeId: record.id, creditsBalance: record.creditsBalance };
}

export interface AccessCodeStatus {
  creditsBalance: number;
  revoked: boolean;
}

/** For pages that already trust a session's accessCodeId and just need
 * the current balance to display (spec 5 screen 2: "N reports
 * remaining") — no rate limiting, since this isn't a code guess. */
export async function getAccessCodeStatus(db: Database, accessCodeId: string): Promise<AccessCodeStatus | null> {
  const [record] = await db.select().from(accessCodes).where(eq(accessCodes.id, accessCodeId)).limit(1);
  if (!record) return null;
  return { creditsBalance: record.creditsBalance, revoked: record.revokedAt !== null };
}

/** Issues a new code (operator-dashboard spec.md §4 screen 3) — same
 * shape as scripts/issue-code.ts, reused instead of duplicated so the
 * admin UI and the CLI script produce identical codes. */
export async function issueAccessCode(
  db: Database,
  label: string,
  credits: number,
): Promise<{ code: string; accessCodeId: string }> {
  const code = generateAccessCode();
  const [created] = await db
    .insert(accessCodes)
    .values({ codeHash: hashAccessCode(code), label, creditsBalance: credits })
    .returning({ id: accessCodes.id });
  return { code, accessCodeId: created.id };
}

/** One-way revocation (operator-dashboard spec.md, Decisions: "no
 * un-revoke") — checkAccessCode and reserveCredits already treat a
 * revoked code as blocked; this is the first thing that can set it. */
export async function revokeAccessCode(db: Database, accessCodeId: string): Promise<void> {
  await db.update(accessCodes).set({ revokedAt: new Date() }).where(eq(accessCodes.id, accessCodeId));
}

export interface CustomerAccessCode {
  id: string;
  label: string;
  creditsBalance: number;
  revokedAt: Date | null;
  createdAt: Date;
}

/** Every issued code except the operator sentinel (D5) — the admin
 * codes screen and any other customer-facing list should call this,
 * not query access_codes directly, so the exclusion lives in one place. */
export async function listCustomerAccessCodes(db: Database): Promise<CustomerAccessCode[]> {
  const rows = await db
    .select()
    .from(accessCodes)
    .where(ne(accessCodes.label, OPERATOR_CODE_LABEL))
    .orderBy(desc(accessCodes.createdAt));

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    creditsBalance: row.creditsBalance,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  }));
}
