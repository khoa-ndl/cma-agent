// The manual tool loop (spec 4.3). Depends only on the ModelTurn
// function type from model-client.ts, not the SDK itself — a scripted
// fake implementing that same type exercises every path here (A5, A11,
// A14) with no network call and no cost.
import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { DataProvider } from "@/lib/data/provider";
import type { Subject } from "@/lib/engine/adjustments";
import { createRunState, createTools, type CmaResult } from "./tools";
import { SYSTEM_PROMPT } from "./prompt";
import type { ModelContentBlock, ModelTurn } from "./model-client";

export type AgentProgressEvent =
  | { type: "tool_call"; turn: number; tool: string; input: unknown }
  | { type: "tool_result"; turn: number; tool: string; ok: boolean };

export type AgentFailureReason =
  | "turn_limit_exceeded"
  | "token_limit_exceeded"
  | "refusal"
  | "truncated"
  | "no_final_result";

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export type AgentRunOutcome =
  | { status: "succeeded"; result: CmaResult; usage: AgentUsage; costUsd: number }
  | { status: "failed"; failureReason: AgentFailureReason; usage: AgentUsage; costUsd: number };

const MAX_TURNS = 10;
const MAX_TOTAL_OUTPUT_TOKENS = 50_000;

// Claude Sonnet 5.5 pricing, per million tokens (spec 7.1), checked
// against current pricing when this was written — update if it changes.
const INPUT_COST_PER_MTOK = 2;
const OUTPUT_COST_PER_MTOK = 10;
const CACHE_READ_COST_PER_MTOK = 0.2;

function computeCostUsd(usage: AgentUsage): number {
  return (
    (usage.inputTokens / 1_000_000) * INPUT_COST_PER_MTOK +
    (usage.outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK +
    (usage.cacheReadTokens / 1_000_000) * CACHE_READ_COST_PER_MTOK
  );
}

function addUsage(total: AgentUsage, turn: AgentUsage): void {
  total.inputTokens += turn.inputTokens;
  total.outputTokens += turn.outputTokens;
  total.cacheReadTokens += turn.cacheReadTokens;
}

function toContentBlockParam(block: ModelContentBlock): Anthropic.Beta.Messages.BetaContentBlockParam {
  switch (block.type) {
    case "tool_use":
      return { type: "tool_use", id: block.id, name: block.name, input: block.input };
    case "thinking":
      // Must round-trip unmodified — the SDK returns a 400 otherwise.
      return { type: "thinking", thinking: block.thinking, signature: block.signature };
    case "redacted_thinking":
      return { type: "redacted_thinking", data: block.data };
    case "text":
      return { type: "text", text: block.text };
  }
}

function buildInitialMessage(subject: Subject): string {
  return `Analyze this subject property and produce a CMA.\n\nSubject property:\n${JSON.stringify(subject, null, 2)}`;
}

export async function* runCmaAgent(
  subject: Subject,
  provider: DataProvider,
  modelTurn: ModelTurn,
): AsyncGenerator<AgentProgressEvent, AgentRunOutcome> {
  const asOf = provider.getAsOfDate();
  const state = createRunState();
  const { tools, handlers } = createTools(subject, provider, asOf, state);

  const messages: BetaMessageParam[] = [{ role: "user", content: buildInitialMessage(subject) }];
  const usage: AgentUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const turnResult = await modelTurn(messages, SYSTEM_PROMPT, tools);
    addUsage(usage, turnResult.usage);

    if (turnResult.stopReason === "refusal") {
      return { status: "failed", failureReason: "refusal", usage, costUsd: computeCostUsd(usage) };
    }
    if (turnResult.stopReason === "max_tokens") {
      return { status: "failed", failureReason: "truncated", usage, costUsd: computeCostUsd(usage) };
    }
    if (usage.outputTokens > MAX_TOTAL_OUTPUT_TOKENS) {
      return { status: "failed", failureReason: "token_limit_exceeded", usage, costUsd: computeCostUsd(usage) };
    }

    messages.push({ role: "assistant", content: turnResult.content.map(toContentBlockParam) });

    const toolUseBlocks = turnResult.content.filter(
      (block): block is Extract<ModelContentBlock, { type: "tool_use" }> => block.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      // tool_choice can't be forced on this model (spec 4.3), so a plain-
      // text turn is possible. Nudge rather than fail — this still counts
      // against the turn limit, so it can't loop forever.
      messages.push({
        role: "user",
        content:
          "Please continue by calling a tool — search_comps, compute_adjustments, compute_price_range or submit_cma — rather than responding in plain text.",
      });
      continue;
    }

    const toolResults: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
    let finalResult: CmaResult | null = null;

    for (const block of toolUseBlocks) {
      yield { type: "tool_call", turn, tool: block.name, input: block.input };

      const handler = handlers[block.name];
      const handlerResult = handler
        ? await handler(block.input)
        : { content: `Unknown tool "${block.name}".`, isError: true };

      yield { type: "tool_result", turn, tool: block.name, ok: !handlerResult.isError };

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: handlerResult.content,
        is_error: handlerResult.isError,
      });

      if (handlerResult.finalResult) {
        finalResult = handlerResult.finalResult;
      }
    }

    if (finalResult) {
      return { status: "succeeded", result: finalResult, usage, costUsd: computeCostUsd(usage) };
    }

    messages.push({ role: "user", content: toolResults });
  }

  return { status: "failed", failureReason: "turn_limit_exceeded", usage, costUsd: computeCostUsd(usage) };
}
