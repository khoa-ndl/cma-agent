// Signed session tokens (spec 6, 8): no auth library in Release 1 — Node's
// built-in crypto is enough for "is this the server's own cookie,
// unmodified". The actual HTTP-only cookie is set by the route handlers
// in Step 8; this file only signs and verifies the token's contents.
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface SessionPayload {
  accessCodeId: string;
  issuedAt: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(accessCodeId: string, secret: string): string {
  const payload: SessionPayload = { accessCodeId, issuedAt: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

/** Returns the payload only if the signature matches exactly and the
 * token hasn't expired — null for anything else (malformed, tampered,
 * wrong secret, expired). Never throws on attacker-controlled input. */
export function verifySessionToken(token: string, secret: string): { accessCodeId: string } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded, secret);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  // timingSafeEqual throws on mismatched lengths rather than returning
  // false, so a tampered signature of a different length is checked here
  // first, before the constant-time comparison of equal-length buffers.
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof payload.accessCodeId !== "string" || typeof payload.issuedAt !== "number") return null;
    if (Date.now() - payload.issuedAt > MAX_AGE_MS) return null;
    return { accessCodeId: payload.accessCodeId };
  } catch {
    return null;
  }
}
