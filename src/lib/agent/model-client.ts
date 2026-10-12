// The only file that imports the Anthropic SDK (spec 2.1, portability
// rule 2) — swap point for Bedrock, Vertex or Foundry. loop.ts depends
// only on the ModelTurn function type below, with zero SDK dependency,
// which is what lets its tests run against a scripted fake with no
// network call and no cost.
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill in a value.",
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

function getModelId(): string {
  return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
}

// A proper discriminated union, not an all-optional grab-bag — thinking
// and redacted_thinking carry the real fields the SDK requires them to
// be passed back with unmodified (see the mapping below for why this
// matters).
export type ModelContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "thinking"; thinking: string; signature: string }
  | { type: "redacted_thinking"; data: string };

export interface ModelTurnResult {
  stopReason: string;
  content: ModelContentBlock[];
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

/**
 * One API call, with tools attached — the shape loop.ts depends on. The
 * real implementation below hides every SDK-specific detail; a test can
 * substitute any function matching this type with no SDK involved.
 *
 * Progress events loop.ts emits are per tool call and per turn, not
 * per token (spec 5's UI needs "searching comps…", not a live-typing
 * effect) — streaming the API call itself is still what matters here,
 * since it's what avoids an HTTP timeout on a single long model call.
 */
export type ModelTurn = (
  messages: BetaMessageParam[],
  system: string,
  tools: Anthropic.Beta.Messages.BetaTool[],
) => Promise<ModelTurnResult>;

const MAX_OUTPUT_TOKENS = 8192;

export const runModelTurn: ModelTurn = async (messages, system, tools) => {
  const stream = getClient().beta.messages.stream({
    model: getModelId(),
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
    tools,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  const message = await stream.finalMessage();

  return {
    stopReason: message.stop_reason ?? "end_turn",
    content: message.content.map((block): ModelContentBlock => {
      if (block.type === "text") return { type: "text", text: block.text };
      if (block.type === "tool_use") {
        return { type: "tool_use", id: block.id, name: block.name, input: block.input };
      }
      if (block.type === "thinking") {
        return { type: "thinking", thinking: block.thinking, signature: block.signature };
      }
      if (block.type === "redacted_thinking") {
        return { type: "redacted_thinking", data: block.data };
      }
      // Nothing this agent's request enables (no server tools, web
      // search, or MCP) should ever produce another block type. Fail
      // loudly rather than silently drop something unexpected into an
      // empty text block, which is what corrupted thinking blocks last
      // time this fell through.
      throw new Error(`Unexpected content block type from the model: "${block.type}"`);
    }),
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    },
  };
};

// Diagnostic only (GET /api/health/anthropic) -- added to let the
// operator (or whoever's debugging a deploy) confirm ANTHROPIC_API_KEY
// actually works in the live environment, independent of logging into
// the app or spending a real report's worth of tokens. models.list()
// is a free, side-effect-free call that still requires a valid key, so
// it fails the same way a real report would (401 invalid_api_key) but
// costs nothing.
export async function checkAnthropicConnectivity(): Promise<boolean> {
  try {
    await getClient().models.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}
