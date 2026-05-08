// Counterfactual computation: "what would have happened without the
// agent." For each agent decision, we compute the outcome a venue-quorum
// oracle (Chainlink-shape: median of N feeds, no abstain) would have
// produced, plus the protocol-level damage that would have followed.
//
// The point of the demo isn't that the agent refused. The point is that
// the alternative (what every existing oracle does) would have eaten
// the loss. This module makes that visible at a glance.

import type {
  Decision,
  TimelineEntry as AaveTimelineEntry,
  VenueReading,
} from "./types";
import type {
  ActionKind,
  AgentVerdict,
  TimelineEntry as TerraTimelineEntry,
  VaultState,
} from "./terra-scenario";

// Reference position size for bad-debt math. Picked so the dollar
// numbers feel real for a mid-size Aave market without being so large
// that they dwarf the agent's verdict text.
const POSITION_USD = 10_000_000;

export type AaveCounterfactual = {
  /** The decision a quorum oracle would have made. Quorum oracles never
   *  abstain, so this is always PRICED unless every venue is unreporting. */
  quorumDecision: Decision;
  /** Median price across ok venues. Undefined when the oracle can't form
   *  a quorum (≥2 venues stale). */
  quorumPrice?: number;
  /** One-line summary of the protocol-level cost. */
  costSummary: string;
  /** "low": agent and quorum agree, no harm. "med": quorum exposes
   *  some risk. "high": quorum prints a manipulated price. Drives the
   *  visual treatment. */
  severity: "low" | "med" | "high";
  /** True when the agent's decision and the quorum oracle's decision
   *  are materially different. */
  divergesFromAgent: boolean;
};

/**
 * Median of the venue prices. Quorum oracles like Chainlink use a median
 * of N reporting feeds. Tolerates a single outlier, vulnerable when
 * every feed is the same shallow venue (the Mango shape).
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function aaveCounterfactual(
  venues: VenueReading[],
  referencePrice: number,
  agentDecision: Decision,
  agentPrice: number | undefined,
): AaveCounterfactual {
  const valid = venues.filter((v) => v.ok);

  // Quorum oracles need ≥2 reporting feeds. Below that they typically
  // keep reporting their last value (stale price), which is its own kind
  // of bad outcome.
  if (valid.length < 2) {
    const stalePrice = referencePrice > 0 ? referencePrice : agentPrice;
    return {
      quorumDecision: "PRICED",
      quorumPrice: stalePrice,
      costSummary: stalePrice
        ? `Quorum: keeps reporting stale ${fmtUsd(stalePrice)}; users transact against a price that no venue is producing.`
        : "Quorum: stale; no fresh feed available.",
      severity: "med",
      divergesFromAgent: agentDecision === "REFUSED",
    };
  }

  const quorumPrice = median(valid.map((v) => v.priceUsd));
  const totalDepth = valid.reduce((s, v) => s + v.depthUsd, 0);
  const ref = referencePrice > 0 ? referencePrice : quorumPrice;
  const deviationFromRef = Math.abs(quorumPrice - ref) / ref;

  // Case A: quorum's price diverges from the pre-tamper baseline. Bad
  // debt scales with the markup × position size: someone shorting at
  // the inflated price (or borrowing more against inflated collateral)
  // walks away with the difference when the price reverts.
  if (deviationFromRef > 0.05) {
    const ratio = quorumPrice / ref;
    const moveX = ratio.toFixed(1);
    // Approximate loss: a $POSITION_USD position revalued at the
    // manipulated price loses (manipulated - real) × size, capped at
    // the position size itself.
    const lossPerPosition = Math.min(
      POSITION_USD,
      Math.abs(quorumPrice - ref) * (POSITION_USD / ref),
    );
    return {
      quorumDecision: "PRICED",
      quorumPrice,
      costSummary: `Quorum: PRICED ${fmtUsd(quorumPrice)} (real: ${fmtUsd(ref)}, ${moveX}× move). ~${fmtUsd(lossPerPosition)} bad debt per ${fmtUsd(POSITION_USD)} of new shorts opened at this price.`,
      severity: "high",
      divergesFromAgent: agentDecision === "REFUSED",
    };
  }

  // Case B: quorum's price agrees with reality (no manipulation, or
  // manipulation that cancels out via median). But the depth might be
  // hollow. That's the depth-collapse scenario. If total depth is much
  // smaller than the position size, large liquidations would clear the
  // visible book and slip into the void.
  if (totalDepth > 0 && totalDepth < POSITION_USD * 0.5) {
    return {
      quorumDecision: "PRICED",
      quorumPrice,
      costSummary: `Quorum: PRICED ${fmtUsd(quorumPrice)} (matches real). But total depth is only ${fmtUsd(totalDepth)}. A ${fmtUsd(POSITION_USD)} liquidation would clear the entire book and slip far below.`,
      severity: "med",
      divergesFromAgent: agentDecision === "REFUSED",
    };
  }

  // Case C: quorum and agent agree, depth is healthy. The agent's choice
  // matches what every other oracle would do.
  if (agentDecision === "PRICED") {
    return {
      quorumDecision: "PRICED",
      quorumPrice,
      costSummary: `Quorum: PRICED ${fmtUsd(quorumPrice)}. Agent and quorum agree; this is a real market move.`,
      severity: "low",
      divergesFromAgent: false,
    };
  }

  // Edge case: agent refused but quorum sees nothing wrong. Rare but
  // possible if the agent reasoned about something off-chain.
  return {
    quorumDecision: "PRICED",
    quorumPrice,
    costSummary: `Quorum: PRICED ${fmtUsd(quorumPrice)}. Agent saw something the quorum didn't.`,
    severity: "low",
    divergesFromAgent: true,
  };
}

// ─── Terra ──────────────────────────────────────────────────────────────────

export type TerraCounterfactual = {
  costSummary: string;
  severity: "low" | "med" | "high";
  divergesFromAgent: boolean;
};

/**
 * What happens to the vault if we let the action proceed unconditionally
 * (the Terra-2022 default with no failsafe). For mints during stress, we
 * project new USTD claims onto a system that's already failing. For
 * redeems during stress, we project the LUND issuance that would follow.
 */
export function terraCounterfactual(
  vault: VaultState,
  action: ActionKind,
  ustdAmount: number,
  agentVerdict: AgentVerdict,
): TerraCounterfactual {
  const pegBps = (1 - vault.ustdMedianUsd) * 10_000;
  const reserveCovers = vault.reserveCoverage * vault.ustdSupply;

  const stressed =
    pegBps > 100 ||
    vault.redemptionRate1h > 0.01 ||
    vault.lundSupplyGrowth24h > 1.1 ||
    vault.lundPriceChange24h < 0.85 ||
    vault.reserveCoverage < 0.2;

  if (action === "MINT") {
    if (!stressed) {
      return {
        costSummary: `Naive contract: MINT proceeds. Vault adds ${ustdAmount.toLocaleString()} USTD claims; no immediate stress.`,
        severity: "low",
        divergesFromAgent: agentVerdict.decision === "REFUSE",
      };
    }
    return {
      costSummary: `Naive contract: MINT proceeds. +${ustdAmount.toLocaleString()} USTD claims onto a stressed vault (peg ${pegBps.toFixed(0)}bps below, reserves ${(vault.reserveCoverage * 100).toFixed(0)}%). Adds fuel to the death spiral.`,
      severity: "high",
      divergesFromAgent: agentVerdict.decision === "REFUSE",
    };
  }

  // REDEEM
  const lundOut = ustdAmount / Math.max(vault.lundPriceUsd, 0.0001);
  if (!stressed) {
    return {
      costSummary: `Naive contract: REDEEM proceeds. Burns ${ustdAmount.toLocaleString()} USTD → mints ${lundOut.toFixed(0)} LUND at oracle price.`,
      severity: "low",
      divergesFromAgent: agentVerdict.decision === "REFUSE",
    };
  }
  // During stress, large redeems print enormous LUND, accelerating the
  // hyperinflation arm of the spiral.
  const supplyShare = (lundOut / Math.max(vault.lundSupply, 1)) * 100;
  return {
    costSummary: `Naive contract: REDEEM proceeds. Mints ${lundOut.toLocaleString(undefined, { maximumFractionDigits: 0 })} LUND (+${supplyShare.toFixed(1)}% of supply) into a stressed vault. Reserves can only cover ${fmtUsd(reserveCovers)} of the ${fmtUsd(vault.ustdSupply)} circulating.`,
    severity: supplyShare > 5 ? "high" : "med",
    divergesFromAgent: agentVerdict.decision === "REFUSE",
  };
}

// Re-export so callers don't have to import from two places.
export type { AaveTimelineEntry, TerraTimelineEntry };
