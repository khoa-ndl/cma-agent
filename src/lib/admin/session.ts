// Signed admin session tokens (operator-dashboard spec.md, Decisions).
// Independent sign/verify from lib/credits/session.ts, not a thin
// wrapper around it -- the payload's own shape ({ kind: "admin" } vs
// { accessCodeId }) is what keeps an admin token from ever
// authenticating as an end-user session, and vice versa (D2), even
// though both reuse SESSION_SECRET.
import { createHmac, timingSafeEqual } from "node:crypto";
import { MAX_AGE_MS } from "@/lib/credits/session";

interface AdminSessionPayload {
  kind: "admin";
  issuedAt: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSessionToken(secret: string): string {
  const payload: AdminSessionPayload = { kind: "admin", issuedAt: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

/** Returns the payload only if the signature matches exactly, the
 * shape is an admin payload, and it hasn't expired -- null for
 * anything else. Never throws on attacker-controlled input. */
export function verifyAdminSessionToken(token: string, secret: string): { kind: "admin" } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded, secret);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<AdminSessionPayload>;
    if (payload.kind !== "admin" || typeof payload.issuedAt !== "number") return null;
    if (Date.now() - payload.issuedAt > MAX_AGE_MS) return null;
    return { kind: "admin" };
  } catch {
    return null;
  }
}
