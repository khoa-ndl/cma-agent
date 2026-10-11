// `access_attempts` rate limiting (plan.md Step 6) needs the caller's IP.
// Vercel sets x-forwarded-for with the client first, proxies after it.
export function clientIp(forwardedFor: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || "unknown";
}
