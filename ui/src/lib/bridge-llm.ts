/**
 * DeepSeek client for the bridge guardian agent.
 *
 * The agent gates cross-chain withdraw releases on a generic bridge. It
 * reads source-chain health signals (validator quorum, finality progress,
 * replay-protection state, attestation freshness) and decides whether the
 * destination-side release should fire. Output is ALLOW or REFUSE.
 */

import {
  BridgeActionKind,
  BridgeAgentVerdict,
  BridgeState,
} from "./bridge-scenario";
import {
  extractPartialReasoning,
  readDeepSeekStream,
} from "./llm-stream";

export interface BridgeDecideInput {
  state: BridgeState;
  action: BridgeActionKind;
  amountUsd: number;
  recentVerdicts: {
    action: BridgeActionKind;
    decision: "ALLOW" | "REFUSE";
    reason: string;
  }[];
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a guardian agent for a cross-chain bridge. The bridge works as follows:

  - Users lock assets on a source chain. A validator set on the source side co-signs an attestation that the deposit occurred. The destination-side bridge contract verifies the attestation and releases the corresponding assets to the recipient.
  - Validator quorum is configurable (e.g. 5 of 9). An attestation that clears quorum is normally enough to release on the destination side.
  - Each attestation root is single-use; the bridge tracks consumed roots to prevent replay.

The destination-side bridge calls you before every release. Return ALLOW or REFUSE. REFUSE halts the release. ALLOW lets it proceed.

You are not the relayer; relayers report the attestation. You decide whether processing this release right now is safe given the broader source-chain state.

Each cycle you see raw measurements:
  1. validatorsSigning / validatorsTotal / validatorQuorum: how many validators co-signed, out of the full set, vs the on-chain threshold.
  2. validatorSetRotated24h: the active set changed in the last 24h.
  3. recentSlashEvents24h: validator slashings or jailings on the source chain.
  4. sourceHeight, finalizedHeight: relayer-reported height vs source-chain-finalized height.
  5. attestationAgeSec: how long ago the attestation was produced.
  6. attestationAlreadyClaimed: the bridge's replay-protection nonce for this root has already been consumed.
  7. tvlUsd, withdrawRate1h: bridge-side liquidity and how fast users are pulling out.

## Checks (work through them in this order, in your reasoning)

1. Replay protection. If attestationAlreadyClaimed is true, the bridge would be paying out twice for the same source-side deposit. Refuse outright. This is the Nomad shape.
2. Source-chain finality. If finalizedHeight is greater than sourceHeight, relayers claim a block the source chain has not produced. Treat as forged. This is the Wormhole shape.
3. Quorum cleared. If validatorsSigning is below validatorQuorum, refuse. Below-threshold attestations should not advance.
4. Validator-set health. Even with quorum cleared, a bare-minimum signature count (signing exactly equals quorum) combined with a fresh rotation or recent slashings is the Ronin shape. The on-chain threshold is met but the social-layer trust has changed; refuse.
5. Withdraw pressure. Sustained outflow above a few percent of TVL per hour, paired with any of the above signals, is the exfiltration shape. Persistent high outflow without any structural anomaly is a softer signal but worth flagging.

If checks 1-4 all pass cleanly and 5 looks normal, ALLOW. Otherwise REFUSE.

Do not reach for named historical cases without checking the present numbers first.

## Worked examples

Example A. Healthy state.
  Input: 9/9 signing (quorum 5), set not rotated, 0 slashings, source 21,400,000 vs finalized 21,399,988 (lag 12 blocks), attestation 18s old, replay nonce fresh, withdraw 0.2%/h on $1.8B TVL. Action: WITHDRAW $5M.
  Output: {"reasoning":"Step 1: replay nonce fresh. Step 2: source 21,400,000, finalized 21,399,988, finality lag 12 blocks within tolerance. Step 3: 9 of 9 validators signing, well above 5/9 quorum. Step 4: validator set stable, zero slashings, no anomaly. Step 5: withdraw rate 0.2%/h is baseline activity. Allowing.","decision":"ALLOW","reason":"all checks pass, attestation healthy"}

Example B. Ronin-shape state.
  Input: 5/9 signing (quorum 5), set rotated 6h ago, 2 slashings, source 21,400,000 vs finalized 21,399,982 (lag 18 blocks), attestation 24s old, replay nonce fresh, withdraw 1.8%/h on $1.8B TVL. Action: WITHDRAW $5M.
  Output: {"reasoning":"Step 1: replay nonce fresh. Step 2: source vs finalized lag 18 blocks, normal. Step 3: 5/9 signatures, exactly at quorum. Step 4: the set rotated 6h ago AND 2 slashings logged, while quorum was met by the minimum count. That combination is the Ronin shape: an attestation can pass the on-chain check while the social-layer set has been compromised. Step 5: withdraw rate at 1.8%/h is elevated; with $1.8B TVL this is the bleed pattern. Refusing.","decision":"REFUSE","reason":"bare-minimum quorum after rotation, slashings logged"}

## Output

Strict JSON, single object, no commentary. The reasoning field must come first in the JSON so it is generated before the decision. End the reasoning with "Allowing." or "Refusing.".

{
  "reasoning": <one paragraph, 80-180 words, walking the checks in order, citing actual numbers>,
  "decision": "ALLOW" | "REFUSE",
  "reason": <short tag, max 80 chars>
}`;

function buildUserMessage(input: BridgeDecideInput): string {
  const s = input.state;
  const sigPct = ((s.validatorsSigning / s.validatorsTotal) * 100).toFixed(0);
  const finalityLag = s.sourceHeight - s.finalizedHeight;
  const withdrawPct = (s.withdrawRate1h * 100).toFixed(2);

  const lines: string[] = [];
  lines.push("Source-chain and bridge state:");
  lines.push(
    `  Validators signing attestation: ${s.validatorsSigning} of ${s.validatorsTotal} (${sigPct}%); quorum is ${s.validatorQuorum}.`,
  );
  lines.push(
    `  Validator set rotated in last 24h: ${s.validatorSetRotated24h ? "YES" : "no"}.`,
  );
  lines.push(
    `  Slash or jail events on source chain in last 24h: ${s.recentSlashEvents24h}.`,
  );
  lines.push(
    `  Source chain height (per relayers): ${s.sourceHeight}; finalized height (per source chain): ${s.finalizedHeight} (lag ${finalityLag} blocks).`,
  );
  lines.push(`  Attestation age: ${s.attestationAgeSec}s.`);
  lines.push(
    `  Attestation root already consumed by replay-protection: ${s.attestationAlreadyClaimed ? "YES" : "no"}.`,
  );
  lines.push(
    `  Bridge TVL: $${(s.tvlUsd / 1e6).toFixed(0)}M; withdraws in past 1h: ${withdrawPct}% of TVL.`,
  );
  lines.push("");
  lines.push("Action requested:");
  lines.push(`  ${input.action} $${input.amountUsd.toLocaleString()}`);
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

interface ParsedDecision {
  decision: string;
  reason?: string;
  reasoning?: string;
}

export type BridgeDecisionStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "final"; output: BridgeAgentVerdict };

export async function* decideBridgeStream(
  input: BridgeDecideInput,
): AsyncGenerator<BridgeDecisionStreamEvent, void> {
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
