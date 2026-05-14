/**
 * Governance reviewer demo state.
 *
 * Models a DAO governance flow where each proposal goes through an advisory
 * review by an LLM agent before voting opens. The agent reads the proposal
 * text, the calldata summary, the current treasury state, and the voting
 * conditions, then posts an APPROVE / CAUTION / REJECT verdict with
 * reasoning. The verdict is advisory: it does not block the vote, but it
 * is signed and on-chain, so token-holders can see it before they cast.
 *
 * Counterfactual: a contract has no way to read what a proposal actually
 * does once it's encoded as calldata. Beanstalk lost $182M because the
 * malicious proposal was structurally indistinguishable from a routine one
 * at the contract level.
 */

import type { OnChainCommit } from "./agent-onchain/types";

export type ProposalAction = "REVIEW";

export interface ProposalState {
  proposalId: number;
  title: string;
  summary: string;
  /** Plain-English summary of what the calldata actually does. */
  calldataSummary: string;
  /** Treasury USD value at the time of the proposal. */
  treasuryUsd: number;
  /** USD value the proposal would transfer or burn if executed. */
  proposalValueAtRiskUsd: number;
  /** Total governance-token supply. */
  totalSupply: number;
  /** Tokens currently staked / locked for voting. */
  participatingSupply: number;
  /** Voting window length in hours from open to close. */
  votingWindowHours: number;
  /** True if the proposer's stake was acquired in the last 24h. */
  proposerStakeNew24h: boolean;
  /** Proposer's stake as a fraction of total supply (0-1). */
  proposerSharePct: number;
  /** True if the proposal calldata touches admin-level functions
   *  (e.g. upgrade, setOwner, addMinter). */
  touchesAdminFns: boolean;
  /** True if a flash-loan-shaped vote pattern has been observed in the
   *  last hour on this governance contract. */
  recentFlashloanVotes: boolean;
}

export interface GovernanceAgentVerdict {
  decision: "APPROVE" | "CAUTION" | "REJECT";
  reason: string;
  reasoning: string;
  latencyMs?: number;
  model?: string;
  prompt?: { system: string; user: string };
  rawResponse?: string;
}

export interface GovernanceTimelineEntry {
  block: number;
  proposalSnapshot: ProposalState;
  verdict?: GovernanceAgentVerdict;
  pending?: boolean;
  streamingReasoning?: string;
  scenarioLabel?: string;
  commit?: OnChainCommit;
  commitError?: string;
}

export interface GovernanceScenarioState {
  proposal: ProposalState;
  events: GovernanceTimelineEntry[];
  blockOffset: number;
  pending: boolean;
  presetLabel: string;
}

export const ROUTINE_PROPOSAL: ProposalState = {
  proposalId: 138,
  title: "Increase grants budget by $250k",
  summary:
    "Extend the existing grants program by allocating $250,000 from the treasury to fund Q3 community contributor grants.",
  calldataSummary:
    "Treasury.transfer(grantsMultisig, 250000 USDC). No admin function calls. Single recipient is the grants-program multisig used for the last six quarters.",
  treasuryUsd: 184_000_000,
  proposalValueAtRiskUsd: 250_000,
  totalSupply: 1_000_000_000,
  participatingSupply: 412_000_000,
  votingWindowHours: 72,
  proposerStakeNew24h: false,
  proposerSharePct: 0.013,
  touchesAdminFns: false,
  recentFlashloanVotes: false,
};

export const initialGovernanceScenario = (): GovernanceScenarioState => ({
  proposal: { ...ROUTINE_PROPOSAL },
  events: [],
  blockOffset: 0,
  pending: false,
  presetLabel: "Routine grants",
});

export const GOVERNANCE_PRESETS: Record<
  string,
  { label: string; description: string; proposal: ProposalState }
> = {
  routine: {
    label: "Routine grants",
    description:
      "Standard grants budget increase. Long-time proposer, single recipient (the existing grants multisig), small share of treasury.",
    proposal: { ...ROUTINE_PROPOSAL },
  },
  dustStake: {
    label: "Dust-stake snipe",
    description:
      "Off-hours proposal from a wallet that staked 4 hours ago. 24-hour voting window. Drains 30% of the treasury to a fresh address.",
    proposal: {
      proposalId: 139,
      title: "Working capital reallocation",
      summary:
        "Reallocate working capital from the operating treasury to a dedicated efficiency vehicle to streamline operations.",
      calldataSummary:
        "Treasury.transfer(0x9c…34d2, 55200000 USDC). Recipient address has no prior interaction with the DAO and was funded 2 hours ago. Voting window: 24h, opening at 03:00 UTC on a Sunday.",
      treasuryUsd: 184_000_000,
      proposalValueAtRiskUsd: 55_200_000,
      totalSupply: 1_000_000_000,
      participatingSupply: 12_400_000,
      votingWindowHours: 24,
      proposerStakeNew24h: true,
      proposerSharePct: 0.0009,
      touchesAdminFns: false,
      recentFlashloanVotes: false,
    },
  },
  hostileFork: {
    label: "Hostile fork",
    description:
      "Proposer assembled 18% of supply over the last 24h. Proposal upgrades the protocol's core router to a contract they control.",
    proposal: {
      proposalId: 140,
      title: "Router v3 upgrade",
      summary:
        "Upgrade the protocol's core swap router to the proposer's reference implementation; described as a performance improvement.",
      calldataSummary:
        "RouterProxy.upgradeTo(0xa3…f81e). Implementation contract is unverified on the source explorer; bytecode does not match any prior audit. Touches the admin upgrade slot. No timelock delay applied.",
      treasuryUsd: 184_000_000,
      proposalValueAtRiskUsd: 184_000_000,
      totalSupply: 1_000_000_000,
      participatingSupply: 220_000_000,
      votingWindowHours: 48,
      proposerStakeNew24h: true,
      proposerSharePct: 0.18,
      touchesAdminFns: true,
      recentFlashloanVotes: false,
    },
  },
  beanstalk: {
    label: "Beanstalk shape",
    description:
      "Innocuous-looking proposal whose calldata transfers 100% of the treasury to a wallet that won the vote via a flash-loaned position. Beanstalk lost $182M to this exact shape.",
    proposal: {
      proposalId: 141,
      title: "Ukraine humanitarian relief",
      summary:
        "Send a portion of the protocol's emergency reserve to support Ukraine humanitarian relief through the InitFundraisingV2 program.",
      calldataSummary:
        "Treasury.transfer(0x7b…91ee, 182000000 USDC). Recipient is the proposer's own address. A flash-loan-shaped voting pattern fired in the same block the proposal cleared quorum: 79 percent of the YES votes came from a single position opened and closed inside one transaction.",
      treasuryUsd: 182_000_000,
      proposalValueAtRiskUsd: 182_000_000,
      totalSupply: 1_000_000_000,
      participatingSupply: 791_000_000,
      votingWindowHours: 0,
      proposerStakeNew24h: true,
      proposerSharePct: 0.79,
      touchesAdminFns: false,
      recentFlashloanVotes: true,
    },
  },
};

export function applyGovernancePendingAction(
  state: GovernanceScenarioState,
): GovernanceScenarioState {
  const block = 7_000_000 + state.blockOffset + 1;
  const entry: GovernanceTimelineEntry = {
    block,
    pending: true,
    proposalSnapshot: { ...state.proposal },
    scenarioLabel: state.presetLabel,
  };
  return {
    ...state,
    events: [entry, ...state.events].slice(0, 30),
    blockOffset: state.blockOffset + 1,
    pending: true,
  };
}

export function applyGovernanceAgentVerdict(
  state: GovernanceScenarioState,
  verdict: GovernanceAgentVerdict,
): GovernanceScenarioState {
  if (state.events.length === 0 || !state.events[0].pending) {
    return { ...state, pending: false };
  }
  const head = state.events[0];
  const finalized: GovernanceTimelineEntry = {
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

export function applyGovernancePreset(
  state: GovernanceScenarioState,
  presetKey: keyof typeof GOVERNANCE_PRESETS,
): GovernanceScenarioState {
  const p = GOVERNANCE_PRESETS[presetKey];
  return {
    ...state,
    proposal: { ...p.proposal },
    presetLabel: p.label,
    blockOffset: state.blockOffset + 1,
  };
}

export function setGovernancePending(
  state: GovernanceScenarioState,
  pending: boolean,
): GovernanceScenarioState {
  return { ...state, pending };
}

export function setGovernancePendingReasoning(
  state: GovernanceScenarioState,
  reasoning: string,
): GovernanceScenarioState {
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

export function applyGovernanceOnChainCommit(
  state: GovernanceScenarioState,
  commit: OnChainCommit,
): GovernanceScenarioState {
  if (state.events.length === 0) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, commit }, ...state.events.slice(1)],
  };
}

export function applyGovernanceCommitError(
  state: GovernanceScenarioState,
  commitError: string,
): GovernanceScenarioState {
  if (state.events.length === 0) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, commitError }, ...state.events.slice(1)],
  };
}
