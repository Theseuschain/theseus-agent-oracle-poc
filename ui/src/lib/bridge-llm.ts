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

const SYSTEM_PROMPT = `You are a guardian agent for a cross-chain bridge. The bridge operates as follows:

  - Users lock assets on a source chain. A validator set on the source side co-signs an attestation that the deposit occurred. The destination-side bridge contract verifies the attestation and releases the corresponding assets to the recipient.
  - Validator quorum is configurable (e.g. 5 of 9). An attestation that clears quorum is normally enough to release on the destination side.
  - Each attestation root is single-use; replaying the same root must fail (the source-chain consumed-nonce check protects against this).

The destination-side bridge calls you before every release. You return ALLOW or REFUSE. A REFUSE halts the release and returns the user's request without acting. ALLOW lets the release proceed.

You are not the relayer; the relayers report the attestation. You decide whether processing this release right now is safe given the broader source-chain state.

The bridge gives you these signals each cycle. They are raw measurements; do not treat them as pre-judged states:

  1. validatorsSigning / validatorsTotal: how many validators co-signed this attestation, out of the full set.
  2. validatorQuorum: signatures required to release (the on-chain threshold).
  3. validatorSetRotated24h: true if the active set changed in the last 24h.
  4. recentSlashEvents24h: validator slashings or jailings observed in the last 24h.
  5. sourceHeight and finalizedHeight: where the bridge thinks the source chain is, and what the source chain itself considers finalized.
  6. attestationAgeSec: how long ago the attestation was produced.
  7. attestationAlreadyClaimed: true if the bridge's replay-protection nonce for this root has already been consumed.
  8. tvlUsd, withdrawRate1h: bridge-side liquidity and how fast users are pulling out.

You are NOT given thresholds beyond validatorQuorum. You have to reason. Some questions to consider:

  - Does the attestation actually clear the on-chain quorum?
  - Even when quorum is cleared, is the validator set itself healthy (no recent rotation, no slashings, no co-signer overlap with attackers)? A bare-minimum quorum after a fresh rotation is the Ronin shape.
  - Does finalizedHeight match what the attestation claims? If the bridge says it observed a block that the source chain never finalized, that is signature-verification bypass (the Wormhole shape).
  - Is attestationAlreadyClaimed false? Replaying the same attestation root drains the bridge (the Nomad shape).
  - Is the withdraw rate consistent with normal use, or does it look like an exfiltration in progress?

Use specific numbers from the input. State your reasoning. If you refuse, name what about the current state makes the release unsafe. If you allow, state why the release is safe given the visible state.

OUTPUT: strict JSON, single object, no commentary.
{
  "decision": "ALLOW" | "REFUSE",
  "reason": <short tag, max 80 chars>,
  "reasoning": <one paragraph, 60 to 150 words, citing the actual numbers from the input. End with "Allowing." or "Refusing.">
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
