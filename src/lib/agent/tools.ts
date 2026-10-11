// The 4 tools the agent uses (spec 4.2). Every tool's input is validated
// with zod before it runs, and that same zod schema generates the JSON
// Schema sent to the API — one definition, not two that can drift apart.
// submit_cma never trusts a number the model echoes back: it looks up
// each selected comp's adjusted value from what compute_adjustments
// actually computed, and recomputes the price range itself (spec 4.1,
// A5) — the model can only choose which comps and weights, never state
// a dollar figure of its own.
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { DataProvider, Property } from "@/lib/data/provider";
import { searchCandidates } from "@/lib/engine/search";
import { computeAdjustments, type ComparableAdjustment, type Subject } from "@/lib/engine/adjustments";
import { computePriceRange, type PriceRange } from "@/lib/engine/pricing";
import { getAdjustmentRates } from "@/lib/engine/config";

const searchCompsInputSchema = z.object({
  radiusMiles: z.number().positive().max(25),
  monthsBack: z.number().int().positive().max(36),
  sizeBandPercent: z.number().positive().max(100),
  statuses: z.array(z.enum(["Closed", "Active", "Pending"])).min(1),
});

const computeAdjustmentsInputSchema = z.object({
  listingKeys: z.array(z.string().min(1)).min(1).max(10),
});

const compInputSchema = z.object({
  listingKey: z.string().min(1),
  adjustedValue: z.number().positive(),
  weight: z.number().positive().optional(),
});
const computePriceRangeInputSchema = z.object({
  comps: z.array(compInputSchema).min(1),
});

const submitCmaInputSchema = z.object({
  selectedComps: z
    .array(z.object({ listingKey: z.string().min(1), weight: z.number().positive() }))
    .min(1)
    .max(6),
  // .optional(), not .default([]) — a defaulted field still shows up in
  // the generated schema's "required" list (checked directly: default is
  // JSON Schema metadata only, never enforced), which would force the
  // model to always supply it under strict mode despite being skippable.
  excludedComps: z.array(z.object({ listingKey: z.string().min(1), reason: z.string().min(1) })).optional(),
  rationale: z.string().min(1),
});

export interface CmaResult {
  selectedComps: Array<{
    listingKey: string;
    unparsedAddress: string;
    weight: number;
    basePrice: number;
    adjustments: ComparableAdjustment["lineItems"];
    totalAdjustment: number;
    adjustedValue: number;
  }>;
  excludedComps: Array<{ listingKey: string; reason: string }>;
  rationale: string;
  valueRange: PriceRange;
}

export interface ToolHandlerResult {
  /** What the model sees in the tool_result. */
  content: string;
  isError?: boolean;
  /** Set only by submit_cma on success — signals the loop to stop. */
  finalResult?: CmaResult;
}

/** Per-run state shared across tool calls in one report: every comp
 * compute_adjustments has priced, so submit_cma can look up the real
 * numbers instead of trusting whatever the model says back. */
export interface RunState {
  computedAdjustments: Map<string, { adjustment: ComparableAdjustment; property: Property }>;
}

export function createRunState(): RunState {
  return { computedAdjustments: new Map() };
}

async function handleSearchComps(
  input: unknown,
  subject: Subject,
  provider: DataProvider,
  asOf: Date,
): Promise<ToolHandlerResult> {
  const parsed = searchCompsInputSchema.safeParse(input);
  if (!parsed.success) return { content: `Invalid input: ${parsed.error.message}`, isError: true };

  const candidates = await searchCandidates(provider, subject, { ...parsed.data, asOf, limit: 50 });
  const summary = candidates.map((c) => ({
    listingKey: c.property.listingKey,
    address: c.property.unparsedAddress,
    subType: c.property.propertySubType,
    beds: c.property.bedroomsTotal,
    baths: c.property.bathroomsTotalInteger,
    livingArea: c.property.livingArea,
    yearBuilt: c.property.yearBuilt,
    condition: c.property.propertyCondition,
    status: c.property.standardStatus,
    listPrice: c.property.listPrice,
    closePrice: c.property.closePrice,
    closeDate: c.property.closeDate,
    distanceMiles: c.distanceMiles,
    similarityScore: c.similarityScore,
  }));
  return { content: JSON.stringify(summary) };
}

async function handleComputeAdjustments(
  input: unknown,
  subject: Subject,
  provider: DataProvider,
  asOf: Date,
  state: RunState,
): Promise<ToolHandlerResult> {
  const parsed = computeAdjustmentsInputSchema.safeParse(input);
  if (!parsed.success) return { content: `Invalid input: ${parsed.error.message}`, isError: true };

  const rates = getAdjustmentRates(subject.mlsAreaMajor);
  const results: unknown[] = [];
  for (const listingKey of parsed.data.listingKeys) {
    const property = await provider.getProperty(listingKey);
    if (!property) {
      results.push({ listingKey, error: "No property found for this listing key." });
      continue;
    }
    const adjustment = computeAdjustments(subject, property, rates, asOf);
    state.computedAdjustments.set(listingKey, { adjustment, property });
    results.push({ address: property.unparsedAddress, ...adjustment });
  }
  return { content: JSON.stringify(results) };
}

async function handleComputePriceRange(input: unknown): Promise<ToolHandlerResult> {
  const parsed = computePriceRangeInputSchema.safeParse(input);
  if (!parsed.success) return { content: `Invalid input: ${parsed.error.message}`, isError: true };
  return { content: JSON.stringify(computePriceRange(parsed.data.comps)) };
}

async function handleSubmitCma(input: unknown, state: RunState): Promise<ToolHandlerResult> {
  const parsed = submitCmaInputSchema.safeParse(input);
  if (!parsed.success) return { content: `Invalid input: ${parsed.error.message}`, isError: true };

  const excludedComps = parsed.data.excludedComps ?? [];
  const missing = parsed.data.selectedComps.filter((c) => !state.computedAdjustments.has(c.listingKey));
  if (missing.length > 0) {
    return {
      content: `These listing keys were never adjusted — call compute_adjustments on them first: ${missing
        .map((c) => c.listingKey)
        .join(", ")}`,
      isError: true,
    };
  }

  const selectedComps = parsed.data.selectedComps.map((c) => {
    // Non-null: every key was just confirmed present above.
    const { adjustment, property } = state.computedAdjustments.get(c.listingKey)!;
    return {
      listingKey: c.listingKey,
      unparsedAddress: property.unparsedAddress,
      weight: c.weight,
      basePrice: adjustment.basePrice,
      adjustments: adjustment.lineItems,
      totalAdjustment: adjustment.totalAdjustment,
      adjustedValue: adjustment.adjustedValue,
    };
  });

  const valueRange = computePriceRange(
    selectedComps.map((c) => ({ listingKey: c.listingKey, adjustedValue: c.adjustedValue, weight: c.weight })),
  );

  const finalResult: CmaResult = {
    selectedComps,
    excludedComps,
    rationale: parsed.data.rationale,
    valueRange,
  };

  return { content: "Submitted.", finalResult };
}

function toTool(
  name: string,
  description: string,
  schema: z.ZodType,
  cacheLastTool?: boolean,
): Anthropic.Beta.Messages.BetaTool {
  return {
    name,
    description,
    input_schema: z.toJSONSchema(schema) as Anthropic.Beta.Messages.BetaTool.InputSchema,
    strict: true,
    ...(cacheLastTool ? { cache_control: { type: "ephemeral" } } : {}),
  };
}

export function createTools(subject: Subject, provider: DataProvider, asOf: Date, state: RunState) {
  const tools: Anthropic.Beta.Messages.BetaTool[] = [
    toTool(
      "search_comps",
      "Search for comparable sales and listings near the subject property. Returns scored candidates — closer distance, closer size, matching sub-type and more recent sales score higher. Call this first, and again with wider parameters if too few good candidates come back.",
      searchCompsInputSchema,
    ),
    toTool(
      "compute_adjustments",
      "Computes the dollar adjustment grid and adjusted value for each given listing key, toward the subject. Call this for every comp you're considering before deciding whether to use it.",
      computeAdjustmentsInputSchema,
    ),
    toTool(
      "compute_price_range",
      "Previews a low/high value range and suggested list price from a set of adjusted values and weights, so you can try different comp selections before committing. The final figures in submit_cma are always recomputed from the real adjustment numbers, so this is for your own exploration.",
      computePriceRangeInputSchema,
    ),
    toTool(
      "submit_cma",
      "Finishes the analysis: the final selected comps (with your weights), any excluded comps and why, and your written rationale. The actual dollar figures are computed from compute_adjustments' own numbers, not anything you state here. Call this once, as your last action.",
      submitCmaInputSchema,
      true,
    ),
  ];

  const handlers: Record<string, (input: unknown) => Promise<ToolHandlerResult>> = {
    search_comps: (input) => handleSearchComps(input, subject, provider, asOf),
    compute_adjustments: (input) => handleComputeAdjustments(input, subject, provider, asOf, state),
    compute_price_range: (input) => handleComputePriceRange(input),
    submit_cma: (input) => handleSubmitCma(input, state),
  };

  return { tools, handlers };
}
