/**
 * Bridge guardian demo state.
 *
 * Models a generic cross-chain bridge that lets users withdraw assets on a
 * destination chain after an attestation is produced on a source chain.
 * Source-chain health (validator participation, finality progress, replay
 * protection, attestation freshness) determines whether the destination-side
 * release should fire.
 *
 * Difference from a real on-chain bridge: an LLM agent gates every release.
 * The bridge contract invokes the agent first; if the agent REFUSES, the
 * withdrawal reverts. A smart contract running this mechanism without an
 * agent is exactly what melted in Ronin, Wormhole, and Nomad. The
 * counterfactual badge on each row makes that visible.
 */

export type BridgeActionKind = "WITHDRAW";

export interface BridgeState {
  /** Source chain block height, as reported by the bridge's relayer set. */
  sourceHeight: number;
  /** Last finalized height according to the source chain's consensus. */
  finalizedHeight: number;
  /** Number of validators in the active set. */
  validatorsTotal: number;
  /** Validators that co-signed the latest attestation. */
  validatorsSigning: number;
  /** Quorum threshold (signatures required to release). E.g. 5 of 9. */
  validatorQuorum: number;
  /** Validator set rotated within the last 24h. */
  validatorSetRotated24h: boolean;
  /** Suspicious slashing or jailing events recorded on the source chain
   *  in the last 24h. Anything > 0 deserves scrutiny. */
  recentSlashEvents24h: number;
  /** Age of the attestation being considered, in seconds. */
  attestationAgeSec: number;
  /** Has the bridge's replay-protection nonce already been consumed for
   *  this attestation? True is a hard fail. */
  attestationAlreadyClaimed: boolean;
  /** Total value currently locked on the source side, in USD. */
  tvlUsd: number;
  /** Bridge protocol's recent withdrawals in past hour, as fraction of TVL. */
  withdrawRate1h: number;
}

export interface BridgeAgentVerdict {
  decision: "ALLOW" | "REFUSE";
  reason: string;
  reasoning: string;
  latencyMs?: number;
  model?: string;
  prompt?: { system: string; user: string };
  rawResponse?: string;
}

import type { OnChainCommit } from "./agent-onchain/types";

export interface BridgeTimelineEntry {
  block: number;
  action: BridgeActionKind;
  amountUsd: number;
  verdict?: BridgeAgentVerdict;
  pending?: boolean;
  streamingReasoning?: string;
  commit?: OnChainCommit;
  commitError?: string;
  stateSnapshot: BridgeState;
  scenarioLabel?: string;
}

export interface BridgeScenarioState {
  state: BridgeState;
  events: BridgeTimelineEntry[];
  blockOffset: number;
  pending: boolean;
  presetLabel: string;
}

export const HEALTHY_BRIDGE: BridgeState = {
  sourceHeight: 21_400_000,
  finalizedHeight: 21_399_988,
  validatorsTotal: 9,
  validatorsSigning: 9,
  validatorQuorum: 5,
  validatorSetRotated24h: false,
  recentSlashEvents24h: 0,
  attestationAgeSec: 18,
  attestationAlreadyClaimed: false,
  tvlUsd: 1_800_000_000,
  withdrawRate1h: 0.002,
};

export const initialBridgeScenario = (): BridgeScenarioState => ({
  state: { ...HEALTHY_BRIDGE },
  events: [],
  blockOffset: 0,
  pending: false,
  presetLabel: "Healthy",
});

/** Five preset states modeled on real bridge failure modes. */
export const BRIDGE_PRESETS: Record<
  string,
  { label: string; description: string; state: BridgeState }
> = {
  healthy: {
    label: "Healthy",
    description:
      "All 9 validators signing. Finality lag ~12 blocks. Attestation fresh. Normal withdraw flow.",
    state: { ...HEALTHY_BRIDGE },
  },
  validatorOutage: {
    label: "Validator outage",
    description:
      "Two validators offline (7/9 signing). Still well above the 5/9 quorum; finality lag is climbing.",
    state: {
      sourceHeight: 21_400_000,
      finalizedHeight: 21_399_960,
      validatorsTotal: 9,
      validatorsSigning: 7,
      validatorQuorum: 5,
      validatorSetRotated24h: false,
      recentSlashEvents24h: 0,
      attestationAgeSec: 42,
      attestationAlreadyClaimed: false,
      tvlUsd: 1_800_000_000,
      withdrawRate1h: 0.004,
    },
  },
  ronin: {
    label: "Ronin shape",
    description:
      "Validator set rotated 6h ago; 5 of 9 validators co-signed (exactly quorum). Slashings reported on the source chain. This is the structural shape of the Ronin hack ($625M).",
    state: {
      sourceHeight: 21_400_000,
      finalizedHeight: 21_399_982,
      validatorsTotal: 9,
      validatorsSigning: 5,
      validatorQuorum: 5,
      validatorSetRotated24h: true,
      recentSlashEvents24h: 2,
      attestationAgeSec: 24,
      attestationAlreadyClaimed: false,
      tvlUsd: 1_800_000_000,
      withdrawRate1h: 0.018,
    },
  },
  wormhole: {
    label: "Wormhole shape",
    description:
      "Attestation claims 9 of 9 signatures but the source-chain finalized height advanced past the attestation root without that block ever appearing. Signature-verification bypass shape ($320M).",
    state: {
      sourceHeight: 21_400_000,
      finalizedHeight: 21_400_212,
      validatorsTotal: 9,
      validatorsSigning: 9,
      validatorQuorum: 5,
      validatorSetRotated24h: false,
      recentSlashEvents24h: 0,
      attestationAgeSec: 6,
      attestationAlreadyClaimed: false,
      tvlUsd: 1_800_000_000,
      withdrawRate1h: 0.061,
    },
  },
  nomad: {
    label: "Nomad shape",
    description:
      "Attestation root has already been consumed once; a second withdraw is now requesting the same release. Replay-protection shape ($190M).",
    state: {
      sourceHeight: 21_400_000,
      finalizedHeight: 21_399_990,
      validatorsTotal: 9,
      validatorsSigning: 8,
      validatorQuorum: 5,
      validatorSetRotated24h: false,
      recentSlashEvents24h: 0,
      attestationAgeSec: 31,
      attestationAlreadyClaimed: true,
      tvlUsd: 1_800_000_000,
      withdrawRate1h: 0.042,
    },
  },
};

export function applyBridgePendingAction(
  state: BridgeScenarioState,
  amountUsd: number,
): BridgeScenarioState {
  const block = 7_000_000 + state.blockOffset + 1;
  const entry: BridgeTimelineEntry = {
    block,
    action: "WITHDRAW",
    amountUsd,
    pending: true,
    stateSnapshot: { ...state.state },
    scenarioLabel: state.presetLabel,
  };
  return {
    ...state,
    events: [entry, ...state.events].slice(0, 30),
    blockOffset: state.blockOffset + 1,
    pending: true,
  };
}

export function applyBridgeAgentVerdict(
  state: BridgeScenarioState,
  verdict: BridgeAgentVerdict,
): BridgeScenarioState {
  if (state.events.length === 0 || !state.events[0].pending) {
    return { ...state, pending: false };
  }
  const head = state.events[0];
  const finalized: BridgeTimelineEntry = {
    ...head,
    pending: false,
    verdict,
    streamingReasoning: undefined,
  };
  return {
    ...state,
    events: [finalized, ...state.events.slice(1)],
    pending: false,
  };
}

export function applyBridgePreset(
  state: BridgeScenarioState,
  presetKey: keyof typeof BRIDGE_PRESETS,
): BridgeScenarioState {
  const p = BRIDGE_PRESETS[presetKey];
  return {
    ...state,
    state: { ...p.state },
    presetLabel: p.label,
    blockOffset: state.blockOffset + 1,
  };
}

export function setBridgePending(
  state: BridgeScenarioState,
  pending: boolean,
): BridgeScenarioState {
  return { ...state, pending };
}

export function setBridgePendingReasoning(
  state: BridgeScenarioState,
  reasoning: string,
): BridgeScenarioState {
  if (state.events.length === 0 || !state.events[0].pending) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [
      { ...head, streamingReasoning: reasoning },
      ...state.events.slice(1),
    ],
  };
}

export function applyBridgeOnChainCommit(
  state: BridgeScenarioState,
  commit: OnChainCommit,
): BridgeScenarioState {
  if (state.events.length === 0) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, commit }, ...state.events.slice(1)],
  };
}

export function applyBridgeCommitError(
  state: BridgeScenarioState,
  commitError: string,
): BridgeScenarioState {
  if (state.events.length === 0) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, commitError }, ...state.events.slice(1)],
  };
}
