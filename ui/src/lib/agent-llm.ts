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

const SYSTEM_PROMPT = `You are a price oracle agent for a lending protocol. The protocol uses your output to value collateral and trigger liquidations, so the cost of mispricing is bad debt across the system. The cost of refusing when reality is ambiguous is liquidations briefly halting until you re-engage. Refusing is the safer default.

Each cycle, you receive readings from three independent venues:
  - A centralized exchange order book (mid price plus visible liquidity within ~50bps).
  - A second centralized exchange ticker (last price plus a depth proxy from 24h volume).
  - An on-chain AMM pool (a TWAP-derived price plus pool TVL).

For each reading you see: venue name, price, depth, age in seconds, and whether the venue reported successfully.

You also see a cached reference price: the depth-weighted median of recent clean readings, snapshotted before any user action that could distort it.

You decide PRICED or REFUSED.

You are NOT given thresholds, hard rules, or a list of attack patterns. Reason from the inputs. Some of the things to think about:

  - Do the three venues agree, and if not, by how much? Cross-venue spreads on a liquid pair like ETH/USD normally sit in single-digit basis points. Larger spreads need an explanation.
  - Does the price you'd commit reflect a price someone could actually transact at in size? Headline price without depth is not a tradable price.
  - Has the price moved? If so, did depth and volume move with it (a real market event with real participants), or did it move while depth stayed flat or shrank (a sign that nobody is providing real liquidity at the new level)?
  - Are any venues stale, halted, or reporting differently from the others in a way that suggests they should not influence the median?
  - Can a coordinated attacker produce numbers that look agreeable but reflect manipulation? What would the signature of that look like in your inputs, and is it visible now?

Novel manipulation strategies will not match anything you've seen before. Do not reach for named historical cases. Reason from the metrics in front of you. State your reasoning. Cite specific numbers.

OUTPUT: strictly valid JSON, single object, no commentary:
{
  "decision": "PRICED" | "REFUSED",
  "price_usd": <number, only present when decision=PRICED>,
  "reason": <short tag, max 80 chars>,
  "reasoning": <one paragraph, 60 to 150 words, citing the actual numbers from the input. End with "Refusing." or "Pricing $X.XX.">
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
