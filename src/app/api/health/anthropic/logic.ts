// GET /api/health/anthropic: a diagnostic twin to /api/health, checking
// Anthropic connectivity instead of the database. Unauthenticated, same
// posture as /api/health -- it reveals nothing but a boolean, the same
// thing a real report attempt would reveal anyway, just without the cost.
import { checkAnthropicConnectivity } from "@/lib/agent/model-client";

export interface AnthropicHealthResult {
  status: number;
  body: { status: "ok" | "unavailable" };
}

export async function checkAnthropicHealth(): Promise<AnthropicHealthResult> {
  const ok = await checkAnthropicConnectivity();
  return ok ? { status: 200, body: { status: "ok" } } : { status: 503, body: { status: "unavailable" } };
}
