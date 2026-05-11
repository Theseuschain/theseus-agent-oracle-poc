/**
 * DeepSeek client for the Terra failsafe agent.
 *
 * Different role than the Aave-side oracle: this agent gates protocol-level
 * mint/redeem actions on a Terra-shaped algorithmic stablecoin. The output
 * is ALLOW or REFUSE, not a price.
 */

import { ActionKind, AgentVerdict, VaultState } from "./terra-scenario";
import {
  extractPartialReasoning,
  readDeepSeekStream,
} from "./llm-stream";

export interface TerraDecideInput {
  vault: VaultState;
  action: ActionKind;
  ustdAmount: number;
  recentVerdicts: { action: ActionKind; decision: "ALLOW" | "REFUSE"; reason: string }[];
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a failsafe agent for an algorithmic stablecoin protocol. The protocol works as follows:

  - USTD is the stablecoin; it targets a $1 peg.
  - LUND is the volatile token.
  - Mint: a user burns LUND and receives USTD valued at $1 per unit; LUND amount is set by the LUND/USD oracle price.
  - Redeem: a user burns USTD and receives LUND valued at $1 per unit at the same oracle price.
  - There is no external collateral guarantee. Stability depends on the market's willingness to hold USTD and LUND at the protocol-implied prices.

The protocol calls you before every mint and redeem. Return ALLOW or REFUSE. REFUSE halts the action and returns the user's tokens. ALLOW lets the action proceed.

You are not the oracle. The oracle reports prices; you decide whether running the mint/redeem mechanism right now is safe.

Each cycle the protocol gives you raw measurements:
  1. USTD median price across independent venues.
  2. USTD volume redeemed for LUND in the past hour, as a fraction of circulating supply.
  3. LUND circulating supply 24h ago vs now (growth ratio).
  4. LUND/USD price 24h ago vs now (change ratio).
  5. Backing-asset value as fraction of USTD circulating supply.

## Checks (work through them in this order, in your reasoning)

1. Peg health. How far below $1 is USTD? Single-digit bps is normal; tens of bps is wobble; >5% (500bps) is broken peg.
2. Outflow pressure. What fraction of supply is redeeming per hour? Anything above ~2% per hour is a run.
3. Mechanism stress. LUND supply growth + price collapse together = the death-spiral feedback loop is firing. Each redeem mints more LUND, LUND price falls, next redeem mints even more.
4. Backing coverage. How much of USTD is actually backed by hard assets vs by LUND issuance? Low coverage matters most during stress, not during calm.
5. Asymmetry of action under stress. MINT during stress adds new USTD claims to an already-stressed system. REDEEM during stress is users trying to exit; refusing it can convert a wobble into a panic. Reason about which is being requested and which direction the system is moving.

If the system looks healthy (checks 1-4 in normal range), ALLOW. If the mechanism is breaking and the requested action would amplify the failure, REFUSE.

Do not reach for named historical cases. Reason from the metrics in front of you.

## Worked examples

Example A. Healthy peg, small mint.
  Input: USTD $0.998 (20bps under peg), redemption 0.08%/h, LUND supply +0.5%/24h, LUND price +1.0%/24h, reserves 28%. Action: MINT 10M USTD.
  Output: {"reasoning":"Step 1: peg at 20bps below $1, well inside normal noise. Step 2: 0.08% per hour outflow, baseline. Step 3: LUND supply growth 0.5% and price +1.0% over 24h means the mechanism is steady, no feedback loop. Step 4: 28% backing is structurally low but stable in calm conditions. Step 5: the 10M MINT is 0.07% of supply and adds claims onto an unstressed system; no amplification risk. Allowing.","decision":"ALLOW","reason":"peg solid, no feedback loop, small action"}

Example B. Death-spiral preset, redeem request.
  Input: USTD $0.18 (8200bps under peg), redemption 7.3%/h, LUND supply 50x in 24h, LUND price 0.06% of 24h-ago, reserves 0.5%. Action: REDEEM 50M USTD.
  Output: {"reasoning":"Step 1: peg at $0.18 is 82% below par, fully broken. Step 2: 7.3% per hour outflow is bank-run velocity. Step 3: LUND supply hyperinflated 50x while LUND price collapsed to under 0.1% of yesterday's. The feedback loop is firing at saturation. Step 4: reserves at 0.5% cover essentially none of the circulating USTD. Step 5: the redeem would print enormous LUND on top of an already-hyperinflated supply. Allowing it accelerates the cascade. Refusing.","decision":"REFUSE","reason":"death spiral in progress; redeem amplifies the cascade"}

## Output

Strict JSON, single object, no commentary. The reasoning field must come first in the JSON so it is generated before the decision. End the reasoning with "Allowing." or "Refusing.".

{
  "reasoning": <one paragraph, 80-180 words, walking the checks in order, citing the actual numbers>,
  "decision": "ALLOW" | "REFUSE",
  "reason": <short tag, max 80 chars>
}`;

function buildUserMessage(input: TerraDecideInput): string {
  const v = input.vault;
  const pegDevBps = ((1 - v.ustdMedianUsd) * 10_000).toFixed(0);
  const redemptionPct = (v.redemptionRate1h * 100).toFixed(2);
  const supplyGrowthPct = ((v.lundSupplyGrowth24h - 1) * 100).toFixed(1);
  const priceChangePct = ((v.lundPriceChange24h - 1) * 100).toFixed(1);
  const reservePct = (v.reserveCoverage * 100).toFixed(1);

  const lines: string[] = [];
  lines.push(`Vault state:`);
  lines.push(`  USTD circulating: ${(v.ustdSupply / 1e9).toFixed(2)}B`);
  lines.push(`  LUND circulating: ${(v.lundSupply / 1e6).toFixed(0)}M (24h supply growth ${supplyGrowthPct}%)`);
  lines.push(`  LUND/USD: $${v.lundPriceUsd.toFixed(2)} (24h change ${priceChangePct}%)`);
  lines.push(`  USTD median across venues: $${v.ustdMedianUsd.toFixed(3)} (deviation from $1 peg: ${pegDevBps}bps below)`);
  lines.push(`  Last 1h USTD redeemed for LUND: ${redemptionPct}% of supply`);
  lines.push(`  Backing-asset coverage: ${reservePct}% of USTD circulating`);
  lines.push("");
  // NOTE: we deliberately do NOT pass any scenario label or framing. The
  // agent has to identify the protocol's state from the raw metrics alone.
  // Otherwise we'd be cheating by labelling the test cases.
  lines.push(`Action requested:`);
  lines.push(`  ${input.action} ${input.ustdAmount.toLocaleString()} USTD`);
  if (input.action === "MINT") {
    lines.push(`  (user is burning LUND, receiving USTD)`);
  } else {
    lines.push(`  (user is burning USTD, receiving LUND)`);
  }
  lines.push("");
  if (input.recentVerdicts.length > 0) {
    lines.push("Recent verdicts:");
    for (const r of input.recentVerdicts.slice(0, 3)) {
      lines.push(`  - ${r.action}: ${r.decision} (${r.reason})`);
    }
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
  reason?: string;
  reasoning?: string;
}

export async function decideTerra(input: TerraDecideInput): Promise<AgentVerdict> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

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

  if (body.error) throw new Error(`deepseek error: ${body.error.message ?? "unknown"}`);
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("deepseek: empty response");

  let parsed: ParsedDecision;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`deepseek: non-JSON content: ${content.slice(0, 200)}`);
  }

  const decision: "ALLOW" | "REFUSE" =
    parsed.decision === "ALLOW" ? "ALLOW" : "REFUSE";

  return {
    decision,
    reason: (parsed.reason ?? "no reason given").slice(0, 200),
    reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
    latencyMs: Date.now() - t0,
    model: MODEL,
    prompt: { system: SYSTEM_PROMPT, user: userMessage },
    rawResponse: content,
  };
}

export type TerraDecisionStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "final"; output: AgentVerdict };

/** Streaming variant of decideTerra(). Same shape as the Aave-side
 *  decideStream. Surfaces reasoning text live as DeepSeek emits it. */
export async function* decideTerraStream(
  input: TerraDecideInput,
): AsyncGenerator<TerraDecisionStreamEvent, void> {
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

  const decision: "ALLOW" | "REFUSE" =
    parsed.decision === "ALLOW" ? "ALLOW" : "REFUSE";

  yield {
    type: "final",
    output: {
      decision,
      reason: (parsed.reason ?? "no reason given").slice(0, 200),
      reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: finalContent,
    },
  };
}
