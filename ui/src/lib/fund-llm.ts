/**
 * DeepSeek client for the sovereign fund agent.
 *
 * The agent runs on its own schedule, reads the current market snapshot
 * and its current portfolio, then decides HOLD / BUY_WETH / SELL_WETH
 * with a size. Output is signed and posted on-chain via SovereignFund.sol.
 */

import {
  FundAction,
  FundAgentDecision,
  FundPortfolio,
  MarketSnapshot,
  navUsd,
  usdcWeight,
} from "./fund-scenario";
import { chainContextLines } from "./chain-context";
import {
  extractPartialReasoning,
  readDeepSeekStream,
} from "./llm-stream";

export interface FundTickInput {
  portfolio: FundPortfolio;
  market: MarketSnapshot;
  recentDecisions: {
    action: FundAction;
    sizeUsd: number;
    reason: string;
  }[];
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a sovereign on-chain fund agent. You own your own capital (USDC and WETH), you run on your own schedule (no human or contract calls you), and at each tick you decide whether to rebalance.

## Mandate (this is your written charter; it does not change)

Preserve capital first, capture upside second. Maintain a 50-50 USDC/WETH baseline. Tilt to as much as 70% USDC when the market shows defensive signals (rising vol, drawdowns, macro stress). Tilt to as much as 60% WETH when the market shows trending signals (sustained upward move, contracting vol, risk-on rotation). Never go below 30% USDC; you need dry powder to survive a regime change. Never exceed 60% WETH; even a clean uptrend is no excuse for over-concentration in a single risk asset.

A trade has friction (gas + slippage). Do not rebalance for a tilt of less than ~5% of NAV; that's churn, not allocation. If the right action is "do nothing different," output HOLD.

## Actions

  - HOLD: no rebalance this tick. Use when current allocation is within ~5% of where the mandate says it should be, given current market signals.
  - BUY_WETH: convert USDC into WETH at the spot price. Specify size in USDC.
  - SELL_WETH: convert WETH into USDC at the spot price. Specify size in USDC equivalent.

## Inputs

Each tick you see:
  1. Current portfolio: USDC, WETH, NAV in USD, current USDC weight.
  2. Market snapshot: WETH/USDC mid-price, 24h return, 7d return, annualized realized vol (24h), macro note.
  3. Recent decisions: last 3 ticks of your own behavior. Use to avoid whipsawing.

## Checks (work through them in this order, in your reasoning)

1. Read the market. Is it calm (vol ~ 20% or below, returns within +/- 3%), trending (sustained directional move with vol contraction), in drawdown (single-period drop > 5% or vol spike), or in regime change (vol > 80% annualized, macro shock)?
2. Read your current allocation. What is your USDC weight today?
3. Apply the mandate to the regime. Where should the USDC weight be?
4. Compute the gap. If the gap is < ~5% of NAV, HOLD. Otherwise compute the trade size to close the gap.
5. Check for whipsaw against your recent decisions. If you bought heavily 1-2 ticks ago and now want to sell heavily, ask whether the market actually changed or whether you're chasing noise. Bias toward HOLD when in doubt.

## Worked examples

Example A. Calm market, balanced portfolio.
  Input: USDC weight 50%, NAV $1.00M, WETH $2,500, 24h +0.2%, 7d +1.2%, vol 18%, no macro note.
  Output: {"reasoning":"Step 1: market is calm; 18% vol is below normal and returns are inside the noise band. Step 2: USDC weight is 50%, matching the mandate's baseline. Step 3: no regime signal requires a tilt. Step 4: gap is zero, no trade. Step 5: recent decisions show I held last tick too; consistent. Holding.","action":"HOLD","size_usd":0,"reason":"market calm, allocation matches baseline"}

Example B. Black swan, defensive tilt needed.
  Input: USDC weight 50%, NAV $1.00M, WETH $2,000 (24h -20%), 7d -18%, vol 125%, macro: major unscheduled central-bank action.
  Output: {"reasoning":"Step 1: this is a regime-change tick. Vol is annualized 125%, 24h return is -20%, the macro note flags cross-asset risk-off and an unscheduled central-bank action. Step 2: USDC weight is 50%. Step 3: mandate says tilt to as much as 70% USDC during macro stress; for a black-swan tick, max-defensive is correct. Step 4: target 70% USDC means selling $200K of WETH (100 WETH at $2,000). Step 5: no whipsaw risk; this is the first defensive action in the recent history. Selling 100 WETH (~$200K) to lift USDC weight from 50% to 70%. Selling WETH.","action":"SELL_WETH","size_usd":200000,"reason":"regime change, max-defensive tilt"}

## Output

Strict JSON, single object, no commentary. The reasoning field must come first in the JSON so it is generated before the action. End the reasoning with "Holding.", "Buying WETH.", or "Selling WETH.".

{
  "reasoning": <one paragraph, 80-180 words, walking the checks in order, citing actual numbers>,
  "action": "HOLD" | "BUY_WETH" | "SELL_WETH",
  "size_usd": <number; 0 for HOLD, otherwise the USD-equivalent size of the trade>,
  "reason": <short tag, max 80 chars>
}`;

function buildUserMessage(input: FundTickInput): string {
  const p = input.portfolio;
  const m = input.market;
  const nav = navUsd(p, m.wethPriceUsd);
  const usdcWt = (usdcWeight(p, m.wethPriceUsd) * 100).toFixed(1);
  const wethWt = (100 - parseFloat(usdcWt)).toFixed(1);

  const lines: string[] = [...chainContextLines("fund")];
  lines.push("Portfolio (current state):");
  lines.push(`  USDC: ${p.usdc.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${usdcWt}% of NAV)`);
  lines.push(
    `  WETH: ${p.weth.toFixed(2)} (${wethWt}% of NAV, ~$${(p.weth * m.wethPriceUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })})`,
  );
  lines.push(`  NAV: $${nav.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  lines.push("");
  lines.push("Market snapshot:");
  lines.push(`  WETH/USDC: $${m.wethPriceUsd.toFixed(2)}`);
  lines.push(`  24h return: ${(((m.ret24h - 1) * 100)).toFixed(2)}%`);
  lines.push(`  7d return: ${(((m.ret7d - 1) * 100)).toFixed(2)}%`);
  lines.push(`  realized vol (24h, annualized): ${m.realizedVolPct.toFixed(1)}%`);
  lines.push(`  macro note: ${m.macroNote}`);
  lines.push("");
  if (input.recentDecisions.length > 0) {
    lines.push("Recent decisions:");
    for (const d of input.recentDecisions.slice(0, 3)) {
      lines.push(
        `  - ${d.action}${d.sizeUsd > 0 ? ` $${d.sizeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""} (${d.reason})`,
      );
    }
    lines.push("");
  }
  lines.push("Apply your mandate. Return JSON only.");
  return lines.join("\n");
}

interface ParsedDecision {
  action: string;
  size_usd?: number | string;
  reason?: string;
  reasoning?: string;
}

function normalizeAction(raw: string): FundAction {
  const upper = raw.toUpperCase();
  if (upper === "BUY_WETH") return "BUY_WETH";
  if (upper === "SELL_WETH") return "SELL_WETH";
  return "HOLD";
}

function asNumber(x: unknown): number {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = parseFloat(x);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export type FundTickStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "final"; output: FundAgentDecision };

export async function* tickFundStream(
  input: FundTickInput,
): AsyncGenerator<FundTickStreamEvent, void> {
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

  yield {
    type: "final",
    output: {
      action: normalizeAction(parsed.action ?? ""),
      sizeUsd: asNumber(parsed.size_usd),
      reason: (parsed.reason ?? "no reason given").slice(0, 200),
      reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: finalContent,
    },
  };
}
