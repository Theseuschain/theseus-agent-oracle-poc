/**
 * Counterfactual: what would a naive bridge contract (no guardian) have done
 * with this withdraw request, and what would it have cost?
 *
 * The point of the demo isn't that the agent refused. The point is that a
 * naive bridge (validates the signature set, releases the funds) would have
 * shipped the loss the agent caught.
 */

import type { BridgeAgentVerdict, BridgeState } from "./bridge-scenario";

export interface BridgeCounterfactual {
  /** What a naive bridge would have done. */
  naiveDecision: "RELEASE" | "REVERT";
  /** Plain-English summary of the protocol-level cost. */
  costSummary: string;
  /** "low" → no harm; "med" → some exposure; "high" → catastrophic. */
  severity: "low" | "med" | "high";
  /** True when the agent's verdict diverges from the naive contract's. */
  divergesFromAgent: boolean;
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function bridgeCounterfactual(
  state: BridgeState,
  amountUsd: number,
  agentVerdict: BridgeAgentVerdict,
): BridgeCounterfactual {
  // A naive bridge accepts any release where the on-chain quorum threshold
  // is cleared, regardless of validator-set health or attestation freshness.
  const quorumCleared = state.validatorsSigning >= state.validatorQuorum;
  const naiveDecision: "RELEASE" | "REVERT" = quorumCleared
    ? "RELEASE"
    : "REVERT";
  const divergesFromAgent =
    agentVerdict.decision === "ALLOW"
      ? naiveDecision !== "RELEASE"
      : naiveDecision !== "REVERT";

  // Replay-shape: the same attestation root is already consumed. A naive
  // contract that doesn't enforce single-use draws funds twice from the
  // bridge for the same source-side deposit.
  if (state.attestationAlreadyClaimed) {
    return {
      naiveDecision: "RELEASE",
      costSummary: `Naive bridge: RELEASES on a previously-consumed attestation root. Replay-attack shape; loss scales with how many times the attacker reissues the same release. Nomad lost ~${fmtUsd(190_000_000)} via this exact mechanic.`,
      severity: "high",
      divergesFromAgent,
    };
  }

  // Forged-signature / source-finality-mismatch shape: relayers claim a
  // block that the source chain never finalized. A naive contract that only
  // verifies the signature set releases on a fabricated state.
  if (state.finalizedHeight > state.sourceHeight) {
    return {
      naiveDecision: "RELEASE",
      costSummary: `Naive bridge: RELEASES on an attestation whose claimed source height has not been finalized (relayers ahead by ${state.finalizedHeight - state.sourceHeight} blocks). Signature-verification bypass shape; the bridge ships ${fmtUsd(amountUsd)} on a state the source chain never produced. Wormhole lost ~${fmtUsd(320_000_000)} via this shape.`,
      severity: "high",
      divergesFromAgent,
    };
  }

  // Compromised validator set shape: the active set just rotated and the
  // attestation clears quorum by exactly the minimum count. A naive contract
  // doesn't see the social-layer compromise; it just sees a valid signature
  // set.
  const justRotatedTightQuorum =
    state.validatorSetRotated24h &&
    state.validatorsSigning === state.validatorQuorum;
  if (justRotatedTightQuorum || state.recentSlashEvents24h > 0) {
    return {
      naiveDecision: "RELEASE",
      costSummary: `Naive bridge: RELEASES ${fmtUsd(amountUsd)}. Validator set just rotated and quorum is bare-minimum (${state.validatorsSigning} of ${state.validatorsTotal}); with ${state.recentSlashEvents24h} slashings logged, this is the Ronin shape. Bridge can be drained to TVL of ${fmtUsd(state.tvlUsd)}.`,
      severity: "high",
      divergesFromAgent,
    };
  }

  // Sustained-withdraw-pressure shape: not an obvious exploit, but the
  // withdraw rate looks like exfiltration. Naive contracts have no notion
  // of rate.
  if (state.withdrawRate1h > 0.04) {
    const hourlyOutflow = state.withdrawRate1h * state.tvlUsd;
    return {
      naiveDecision: "RELEASE",
      costSummary: `Naive bridge: RELEASES ${fmtUsd(amountUsd)}. Withdraw rate at ${(state.withdrawRate1h * 100).toFixed(1)}%/h (${fmtUsd(hourlyOutflow)} per hour) is consistent with an exfiltration in progress. Naive contract has no rate-limit and adds to the bleed.`,
      severity: "med",
      divergesFromAgent,
    };
  }

  // Quorum not cleared: even the naive contract reverts.
  if (!quorumCleared) {
    return {
      naiveDecision: "REVERT",
      costSummary: `Naive bridge: REVERTS. Quorum not cleared (${state.validatorsSigning} of ${state.validatorsTotal}, threshold ${state.validatorQuorum}). Agent and naive contract agree.`,
      severity: "low",
      divergesFromAgent: false,
    };
  }

  // Healthy case.
  return {
    naiveDecision: "RELEASE",
    costSummary: `Naive bridge: RELEASES ${fmtUsd(amountUsd)}. Quorum cleared, no irregularities; agent and naive contract agree.`,
    severity: "low",
    divergesFromAgent: false,
  };
}
