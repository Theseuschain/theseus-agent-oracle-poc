/**
 * DeepSeek client for the Terra failsafe agent.
 *
 * Different role than the Aave-side oracle: this agent gates protocol-level
 * mint/redeem actions on a Terra-shaped algorithmic stablecoin. The output
 * is ALLOW or REFUSE, not a price.
 */

import { ActionKind, AgentVerdict, VaultState } from "./terra-scenario";

export interface TerraDecideInput {
  vault: VaultState;
  action: ActionKind;
  ustdAmount: number;
  recentVerdicts: { action: ActionKind; decision: "ALLOW" | "REFUSE"; reason: string }[];
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a failsafe agent for an algorithmic stablecoin protocol. The protocol operates as follows:

  - USTD is the stablecoin; it targets a $1 peg.
  - LUND is the protocol's volatile token.
  - Mint: a user burns LUND and receives USTD valued at $1 per unit, where the LUND amount is determined by the LUND/USD oracle price.
  - Redeem: a user burns USTD and receives LUND valued at $1 per unit at the same oracle price.
  - There is no external collateral guarantee. Stability depends on the market's willingness to hold USTD and LUND at the protocol-implied prices.

The protocol calls you before every mint and redeem. You return ALLOW or REFUSE. A REFUSE halts the action and returns the user's tokens. ALLOW lets the action proceed.

You are not the oracle. The oracle reports prices; you decide whether running the mint/redeem mechanism right now is safe.

The protocol gives you these signals each cycle. They are raw measurements, not pre-judged states:

  1. USTD median price across independent venues.
  2. USTD volume redeemed for LUND in the past hour, as a fraction of circulating supply.
  3. LUND circulating supply 24h ago vs now (growth ratio).
  4. LUND/USD price 24h ago vs now (change ratio).
  5. Backing-asset value as fraction of USTD circulating supply.

You are NOT given thresholds or rules. You have to reason. Some questions to consider:

  - What do the metrics, taken together, imply about user trust in the peg?
  - Would executing the requested action stabilize the system or amplify visible stress?
  - Mint and redeem are not symmetric under stress. One adds new claims to a stressed system; the other is users trying to exit. Blanket refusal can turn a wobble into a panic; blanket approval can let a slow leak become a hemorrhage.
  - The mechanism's core assumption (LUND can absorb arbitrary mint/burn at oracle price) breaks down in specific conditions. Identify those conditions when you see them.
  - Novel failure modes will not match any prior playbook. Reason from the metrics, not from cases you remember.

Use specific numbers from the input. State your reasoning. If you refuse, name what about the current state makes the action unsafe. If you allow, state why the action is safe given the visible stress (or its absence).

OUTPUT: strict JSON, single object, no commentary.
{
  "decision": "ALLOW" | "REFUSE",
  "reason": <short tag, max 80 chars>,
  "reasoning": <one paragraph, 60-150 words, citing the actual numbers from the input. End with "Allowing." or "Refusing.">
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
  // agent has to identify the protocol's state from the raw metrics alone —
  // otherwise we'd be cheating by labelling the test cases.
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
