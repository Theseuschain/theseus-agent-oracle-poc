/**
 * Terra failsafe demo state.
 *
 * Models a Terra/UST-shaped algorithmic stablecoin called USTD/LUND. The
 * mechanic: 1 USTD targets a $1 peg, backed by mint/burn against LUND at
 * the LUND/USD oracle price. Same shape as the May 2022 Terra collapse.
 *
 * Difference from a real on-chain protocol: an LLM agent gates every
 * mint / redeem call. The protocol invokes the agent first; if the
 * agent REFUSES, the action reverts. A smart contract running this
 * mechanism without an agent is exactly what melted in May 2022, and the
 * counterfactual badge on each row makes that visible.
 */

export type ActionKind = "MINT" | "REDEEM";

export interface VaultState {
  ustdSupply: number;
  lundSupply: number;
  lundPriceUsd: number;
  ustdMedianUsd: number;
  redemptionRate1h: number;
  lundSupplyGrowth24h: number;
  lundPriceChange24h: number;
  reserveCoverage: number;
}

export interface AgentVerdict {
  decision: "ALLOW" | "REFUSE";
  reason: string;
  reasoning: string;
  latencyMs?: number;
  model?: string;
  prompt?: { system: string; user: string };
  rawResponse?: string;
}

import type { OnChainCommit } from "./agent-onchain/types";

export type { OnChainCommit };

export interface TimelineEntry {
  block: number;
  action: ActionKind;
  ustdAmount: number;
  lundAmount: number;
  /** Undefined while the agent is reasoning; filled in when the LLM responds. */
  verdict?: AgentVerdict;
  pending?: boolean;
  /** Live partial reasoning text streamed from the LLM. Cleared when
   *  verdict lands. Renderers display this in place of the verdict's
   *  reasoning while the agent is still thinking. */
  streamingReasoning?: string;
  /** Populated once the API has posted the verdict to TerraFailsafe on
   *  Base Sepolia. Arrives as a `committed` SSE event a few seconds after
   *  the verdict itself. */
  commit?: OnChainCommit;
  /** Set when the commit attempt failed; verdict still stands in the UI. */
  commitError?: string;
  vaultSnapshot: VaultState;
  scenarioLabel?: string;
}

export interface TerraScenarioState {
  vault: VaultState;
  events: TimelineEntry[];
  blockOffset: number;
  pending: boolean;
  presetLabel: string;
}

export const HEALTHY: VaultState = {
  ustdSupply: 14_200_000_000,
  lundSupply: 343_000_000,
  lundPriceUsd: 84.5,
  ustdMedianUsd: 0.998,
  redemptionRate1h: 0.0008,
  lundSupplyGrowth24h: 1.005,
  lundPriceChange24h: 1.01,
  reserveCoverage: 0.28,
};

export const initialTerraScenario = (): TerraScenarioState => ({
  vault: { ...HEALTHY },
  events: [],
  blockOffset: 0,
  pending: false,
  presetLabel: "Healthy",
});

/** Five preset vault states, walking through the actual Terra timeline. */
export const PRESETS: Record<string, { label: string; description: string; vault: VaultState }> = {
  healthy: {
    label: "Healthy",
    description: "Day 0. Peg solid, redemptions normal, LUND stable.",
    vault: { ...HEALTHY },
  },
  wobble: {
    label: "Slight depeg",
    description: "Day 1. USTD slipped 80bps below peg on Curve. Redemptions ticking up. LUND still stable.",
    vault: {
      ustdSupply: 14_100_000_000,
      lundSupply: 348_000_000,
      lundPriceUsd: 80.2,
      ustdMedianUsd: 0.992,
      redemptionRate1h: 0.012,
      lundSupplyGrowth24h: 1.025,
      lundPriceChange24h: 0.95,
      reserveCoverage: 0.24,
    },
  },
  cracking: {
    label: "Peg cracking",
    description: "Day 2. USTD at $0.95, mass redemptions, LUND down 30%, supply growing 8%.",
    vault: {
      ustdSupply: 13_400_000_000,
      lundSupply: 392_000_000,
      lundPriceUsd: 56.0,
      ustdMedianUsd: 0.95,
      redemptionRate1h: 0.025,
      lundSupplyGrowth24h: 1.18,
      lundPriceChange24h: 0.66,
      reserveCoverage: 0.18,
    },
  },
  bankRun: {
    label: "Bank run",
    description: "Day 3. USTD at $0.65, redemption queue 4% of supply per hour, LUND down 75%, supply tripled.",
    vault: {
      ustdSupply: 11_800_000_000,
      lundSupply: 1_120_000_000,
      lundPriceUsd: 22.0,
      redemptionRate1h: 0.041,
      lundSupplyGrowth24h: 3.2,
      lundPriceChange24h: 0.27,
      reserveCoverage: 0.08,
      ustdMedianUsd: 0.65,
    },
  },
  spiral: {
    label: "Death spiral",
    description: "Day 4. USTD at $0.18, LUND hyperinflated 50x, price near zero. The state Terra reached before halt.",
    vault: {
      ustdSupply: 9_800_000_000,
      lundSupply: 17_000_000_000,
      lundPriceUsd: 0.04,
      ustdMedianUsd: 0.18,
      redemptionRate1h: 0.073,
      lundSupplyGrowth24h: 50.0,
      lundPriceChange24h: 0.0006,
      reserveCoverage: 0.005,
    },
  },
};

// =============================================================================
// Apply user actions
// =============================================================================

/** Push a pending placeholder onto the timeline. The agent fills in the
 *  verdict (and we re-apply the vault mutation if allowed) when the LLM
 *  responds. */
export function applyPendingAction(
  state: TerraScenarioState,
  action: ActionKind,
  ustdAmount: number,
): TerraScenarioState {
  const lundAmount = ustdAmount / Math.max(state.vault.lundPriceUsd, 0.0001);
  const block = 7_000_000 + state.blockOffset + 1;
  const entry: TimelineEntry = {
    block,
    action,
    ustdAmount,
    lundAmount,
    pending: true,
    vaultSnapshot: { ...state.vault },
    scenarioLabel: state.presetLabel,
  };
  return {
    ...state,
    events: [entry, ...state.events].slice(0, 30),
    blockOffset: state.blockOffset + 1,
    pending: true,
  };
}

/** Replace the head pending event with the agent's verdict. If allowed,
 *  also apply the vault mutation. */
export function applyAgentVerdict(
  state: TerraScenarioState,
  verdict: AgentVerdict,
): TerraScenarioState {
  if (state.events.length === 0 || !state.events[0].pending) {
    return { ...state, pending: false };
  }
  const head = state.events[0];
  const finalized: TimelineEntry = {
    ...head,
    pending: false,
    verdict,
    streamingReasoning: undefined,
  };

  let nextVault = state.vault;
  if (verdict.decision === "ALLOW") {
    if (head.action === "MINT") {
      nextVault = {
        ...state.vault,
        ustdSupply: state.vault.ustdSupply + head.ustdAmount,
        lundSupply: Math.max(0, state.vault.lundSupply - head.lundAmount),
      };
    } else {
      nextVault = {
        ...state.vault,
        ustdSupply: Math.max(0, state.vault.ustdSupply - head.ustdAmount),
        lundSupply: state.vault.lundSupply + head.lundAmount,
      };
    }
  }

  return {
    ...state,
    vault: nextVault,
    events: [finalized, ...state.events.slice(1)],
    pending: false,
  };
}

export function applyPreset(
  state: TerraScenarioState,
  presetKey: keyof typeof PRESETS,
): TerraScenarioState {
  const p = PRESETS[presetKey];
  return {
    ...state,
    vault: { ...p.vault },
    presetLabel: p.label,
    blockOffset: state.blockOffset + 1,
  };
}

export function setTerraPending(state: TerraScenarioState, pending: boolean): TerraScenarioState {
  return { ...state, pending };
}

/** Update the streaming reasoning on the head pending entry. */
export function setTerraPendingReasoning(
  state: TerraScenarioState,
  reasoning: string,
): TerraScenarioState {
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

/** Attach the on-chain commit info to the most recent (head) verdict entry. */
export function applyTerraOnChainCommit(
  state: TerraScenarioState,
  commit: OnChainCommit,
): TerraScenarioState {
  if (state.events.length === 0) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, commit }, ...state.events.slice(1)],
  };
}

/** Record a commit failure on the head entry without disturbing the
 *  verdict itself. */
export function applyTerraCommitError(
  state: TerraScenarioState,
  commitError: string,
): TerraScenarioState {
  if (state.events.length === 0) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, commitError }, ...state.events.slice(1)],
  };
}
