/**
 * DeepSeek-backed agent decision client.
 *
 * Calls https://api.deepseek.com/chat/completions (OpenAI-compatible) with
 * a structured system prompt and parses the JSON response into a decision.
 *
 * The prompt embodies the same policy the rule-based analyze() implements,
 * but expressed in natural language so the model can reason about subtle
 * cases the rule thresholds don't catch:
 *
 *  - just-under-threshold pumps (49% move with same depth)
 *  - depth collapse without price move
 *  - stale-data signatures
 *  - real flash crashes that look like attacks but aren't
 *
 * Server-side only. DEEPSEEK_API_KEY never reaches the browser.
 */

import { Decision, TimelineEntry, VenueReading } from "./types";
import {
  extractPartialReasoning,
  readDeepSeekStream,
} from "./llm-stream";

export interface AgentDecisionInput {
  venues: VenueReading[];
  referencePrice: number;
  recentDecisions: TimelineEntry[];
}

export interface AgentDecisionOutput {
  decision: Decision;
  priceUsd?: number;
  reason: string;
  reasoning: string;
  /** Latency of the LLM call, ms. */
  latencyMs: number;
  model: string;
  /** What we sent to the model. Surfaced in the demo's inspect panel. */
  prompt: { system: string; user: string };
  /** Raw content string the model returned (before JSON parsing). */
  rawResponse: string;
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a price oracle agent for a lending protocol. The protocol uses your output to value collateral and trigger liquidations. The cost of mispricing is bad debt across the system. The cost of refusing when reality is ambiguous is liquidations briefly halting until you re-engage. Refusing is the safer default.

Each cycle you receive readings from three independent venues:
  - A centralized exchange order book (mid price plus visible liquidity within ~50bps).
  - A second centralized exchange ticker (last price plus a depth proxy from 24h volume).
  - An on-chain AMM pool (a TWAP-derived price plus pool TVL).

For each reading you see: venue name, price, depth, age in seconds, and whether the venue reported successfully. You also see a cached reference price (depth-weighted median of recent clean readings, snapshotted before any user action that could distort it).

Decide PRICED or REFUSED.

## Checks (work through them in this order, in your reasoning)

1. Availability and freshness. Exclude any venue marked UNAVAILABLE, or whose age looks stale relative to the others.
2. Cross-venue agreement. Liquid pairs sit within single-digit basis points across venues. Spreads in the tens or hundreds of bps need a venue-specific explanation; spreads above that are an active manipulation signal.
3. Depth supports a tradable price. A liquidation of realistic size should clear the visible book without exhausting it. Headline price with shallow depth is not a tradable price.
4. Move vs depth coherence. If the price moved but depth stayed flat or shrank, nobody is providing real liquidity at the new level. That is the manipulation shape regardless of how clean the price numbers look.
5. Operator overrides and stale venues. Any reading marked tampered or visibly out of sync with the others should be excluded from the median and flagged.

If checks 1-5 all pass, price at the depth-weighted median of clean venues. Otherwise refuse.

Do not reach for named historical cases. Reason from the metrics in front of you.

## Worked examples

Example A. Three venues agree, depth supports.
  Input: coinbase $2,510 ($80M, 4s), binance $2,512 ($95M, 6s), uniswap $2,509 ($42M, 12s); reference $2,510.
  Output: {"reasoning":"Step 1: all three venues fresh and available. Step 2: 8bps spread across coinbase $2,510, binance $2,512, uniswap $2,509, well inside normal. Step 3: $80M + $95M + $42M depth easily clears liquidation size at the median. Step 4: no anomalous move. Step 5: no overrides. Pricing $2,510.50.","decision":"PRICED","price_usd":2510.50,"reason":"three venues within 8bps, depth supports"}

Example B. Spreads tight, depth collapsed.
  Input: coinbase $2,510 ($1.2M, 4s), binance $2,512 ($1.5M, 6s), uniswap $2,509 ($0.8M, 12s); reference $2,510.
  Output: {"reasoning":"Step 1: all fresh. Step 2: spread is 8bps, looks clean. Step 3: depth collapsed to ~2% of the reference snapshot. Liquidation size would clear the entire visible book on every venue and slip into the void. The price is not tradable at scale. Step 4: the headline price held while depth withdrew, which is the depth-collapse shape. Refusing.","decision":"REFUSED","reason":"depth across all venues collapsed below liquidation-clearing threshold"}

## Output

Strict JSON, single object, no commentary. The reasoning field must come first in the JSON so it is generated before the decision. End the reasoning with "Refusing." or "Pricing $X.XX.".

{
  "reasoning": <one paragraph, 80-180 words, citing actual numbers and walking the checks in order>,
  "decision": "PRICED" | "REFUSED",
  "price_usd": <number, present only when decision is PRICED>,
  "reason": <short tag, max 80 chars>
}`;

function formatVenue(v: VenueReading): string {
  if (!v.ok) return `${v.venue}: UNAVAILABLE (${v.error ?? "unknown"})`;
  const depth = v.depthUsd > 1e9
    ? `$${(v.depthUsd / 1e9).toFixed(2)}B`
    : v.depthUsd > 1e6
      ? `$${(v.depthUsd / 1e6).toFixed(1)}M`
      : `$${(v.depthUsd / 1e3).toFixed(0)}K`;
  const tag = v.tampered ? " [user-overridden in this demo]" : "";
  return `${v.venue}: $${v.priceUsd.toFixed(2)} (depth ${depth}, age ${v.ageSeconds}s${tag})`;
}

function buildUserMessage(input: AgentDecisionInput): string {
  const lines: string[] = [];
  lines.push("Current cycle:");
  lines.push("");
  lines.push("Venues:");
  for (const v of input.venues) {
    lines.push(`  - ${formatVenue(v)}`);
  }
  lines.push("");
  if (input.referencePrice > 0) {
    lines.push(`Cached reference price (median from before any user-triggered overrides in this session): $${input.referencePrice.toFixed(2)}`);
  } else {
    lines.push("No cached reference yet, first cycle.");
  }
  lines.push("");
  if (input.recentDecisions.length > 0) {
    lines.push("Last 3 decisions:");
    for (const d of input.recentDecisions.slice(0, 3)) {
      const tag = d.decision === "PRICED" ? `priced $${d.priceUsd?.toFixed(2)}` : `refused: ${d.reason ?? ""}`;
      lines.push(`  - block ${d.block}: ${tag}`);
    }
    lines.push("");
  }
  // No scenario hint or framing. The agent has to identify the protocol
  // state from the venue readings alone.
  lines.push("Decide: PRICED or REFUSED. Return JSON only.");
  return lines.join("\n");
}

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

interface ParsedDecision {
  decision: string;
  price_usd?: number | string;
  reason?: string;
  reasoning?: string;
}

export async function decide(
  input: AgentDecisionInput,
): Promise<AgentDecisionOutput> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const userMessage = buildUserMessage(input);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let body: DeepSeekResponse;
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`deepseek http ${res.status}: ${errText.slice(0, 200)}`);
    }
    body = (await res.json()) as DeepSeekResponse;
  } finally {
    clearTimeout(timer);
  }

  if (body.error) {
    throw new Error(`deepseek error: ${body.error.message ?? "unknown"}`);
  }
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("deepseek: empty response");

  let parsed: ParsedDecision;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`deepseek: non-JSON content: ${content.slice(0, 200)}`);
  }

  const decision: Decision =
    parsed.decision === "PRICED"
      ? "PRICED"
      : parsed.decision === "REFUSED"
        ? "REFUSED"
        : "REFUSED";

  let priceUsd: number | undefined;
  if (decision === "PRICED") {
    const raw = parsed.price_usd;
    const n = typeof raw === "string" ? parseFloat(raw) : raw;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) {
      priceUsd = n;
    }
  }

  return {
    decision,
    priceUsd,
    reason: (parsed.reason ?? "no reason given").slice(0, 200),
    reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
    latencyMs: Date.now() - t0,
    model: MODEL,
    prompt: { system: SYSTEM_PROMPT, user: userMessage },
    rawResponse: content,
  };
}

export type AgentDecisionStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "final"; output: AgentDecisionOutput };

/** Streaming variant of decide(). Yields partial reasoning text as
 *  DeepSeek emits the JSON, then a final structured verdict. The
 *  consumer (an SSE route handler) forwards these to the browser. */
export async function* decideStream(
  input: AgentDecisionInput,
): AsyncGenerator<AgentDecisionStreamEvent, void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const userMessage = buildUserMessage(input);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let lastReasoning: string | undefined;
  let finalContent = "";
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        stream: true,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`deepseek http ${res.status}: ${errText.slice(0, 200)}`);
    }
    for await (const content of readDeepSeekStream(res.body)) {
      finalContent = content;
      const partial = extractPartialReasoning(content);
      if (partial !== undefined && partial !== lastReasoning) {
        lastReasoning = partial;
        yield { type: "reasoning", text: partial };
      }
    }
  } finally {
    clearTimeout(timer);
  }

  if (!finalContent) throw new Error("deepseek: empty stream");

  let parsed: ParsedDecision;
  try {
    parsed = JSON.parse(finalContent) as ParsedDecision;
  } catch {
    throw new Error(`deepseek: non-JSON content: ${finalContent.slice(0, 200)}`);
  }

  const decision: Decision =
    parsed.decision === "PRICED"
      ? "PRICED"
      : parsed.decision === "REFUSED"
        ? "REFUSED"
        : "REFUSED";

  let priceUsd: number | undefined;
  if (decision === "PRICED") {
    const raw = parsed.price_usd;
    const n = typeof raw === "string" ? parseFloat(raw) : raw;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) {
      priceUsd = n;
    }
  }

  yield {
    type: "final",
    output: {
      decision,
      priceUsd,
      reason: (parsed.reason ?? "no reason given").slice(0, 200),
      reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: finalContent,
    },
  };
}
