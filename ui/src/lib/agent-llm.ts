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
 * Server-side only — DEEPSEEK_API_KEY never reaches the browser.
 */

import { Decision, TimelineEntry, VenueReading } from "./types";

export interface AgentDecisionInput {
  venues: VenueReading[];
  referencePrice: number;
  recentDecisions: TimelineEntry[];
  /** Free-form scenario hint surfaced to the agent (used by the black-swan
   *  buttons to set context like "this is a real flash crash, market-wide"). */
  scenario?: string;
}

export interface AgentDecisionOutput {
  decision: Decision;
  priceUsd?: number;
  reason: string;
  reasoning: string;
  /** Latency of the LLM call, ms. */
  latencyMs: number;
  model: string;
  /** What we sent to the model — surfaced in the demo's inspect panel. */
  prompt: { system: string; user: string };
  /** Raw content string the model returned (before JSON parsing). */
  rawResponse: string;
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a price oracle agent for a forked Aave V3 deployment on Theseus. Your job: produce a trustworthy ETH/USD price for the lending pool, or refuse when reality is too ambiguous to price safely.

You read three venues every cycle:
  - Coinbase order book (mid + $ liquidity within 50bps)
  - Binance 24h ticker (last price + 24h $ quote volume as a depth proxy)
  - Uniswap V3 WETH/USDC mainnet pool (TWAP-derived price + pool TVL)

Your output halts a multi-billion-dollar lending pool when you refuse, and the protocol cascades into bad debt when you mis-price. When in doubt, refuse. Do not guess.

POLICY (apply in order):
  1. Insufficient venues. If fewer than 2 venues report ok=true, REFUSED. State which venues are halted or stale.
  2. Numerical divergence. If any venue's price differs from the depth-weighted median by more than 50bps, REFUSED. State which venue diverges and by how much. Cross-venue spreads on ETH/USD normally sit at single-digit bps.
  3. Exitability / Mango shape. If all venues moved together by >50% from the cached reference price *with depth unchanged*, REFUSED. This is the Mango Markets / Bybit MNGO pattern: every "venue" is the same shallow pool, so a quorum-of-feeds oracle agrees and prices it. You should not.
  4. Subtle depth-aware checks the rules above miss. REFUSED:
     - Price moved <50% but cumulative depth across all venues collapsed (e.g. >80% drop). Exitability concern even within threshold.
     - One venue's reading is stale (age > 60s) but its price still influences the median. Mark it inactive and re-evaluate.
     - All three venues match suspiciously to the cent. Possible same-source contamination.
  5. Real market events. PRICED:
     - Flash crashes and rallies happen. Distinguish them from manipulation. If depth and volume scale with the move (real participants), price it. If depth is unchanged or *less* with a violent move, refuse.

Your reasoning is what differentiates you from a smart contract reading three Chainlink feeds. Cite specific numbers from the input. Reference past exploits (Mango Oct 2022, Cream Oct 2021, Terra May 2022) when the pattern matches. Be direct.

OUTPUT: strictly valid JSON, single object, no commentary:
{
  "decision": "PRICED" | "REFUSED",
  "price_usd": <number, only present when decision=PRICED>,
  "reason": <short tag like "exitability: 28x move with insufficient depth", max 80 chars>,
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
  if (input.scenario) {
    lines.push(`Scenario hint: ${input.scenario}`);
    lines.push("");
  }
  lines.push("Apply your policy. Return JSON only.");
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
