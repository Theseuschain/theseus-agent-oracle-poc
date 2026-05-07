/**
 * Terra failsafe demo state.
 *
 * Models a Terra/UST-shaped algorithmic stablecoin called USTD/LUND. The
 * mechanic: 1 USTD targets a $1 peg, backed by mint/burn against LUND at
 * the LUND/USD oracle price. Same shape as the May 2022 Terra collapse.
 *
 * Difference from a real on-chain protocol: the agent gates every mint /
 * redeem call. The protocol invokes the agent first; if the agent
 * REFUSES, the action reverts. A smart contract running this same
 * mechanism without an agent is exactly what melted in May 2022.
 */

export type ActionKind = "MINT" | "REDEEM";

export interface VaultState {
  /** USTD circulating supply (units of USTD). */
  ustdSupply: number;
  /** LUND circulating supply (units of LUND). */
  lundSupply: number;
  /** Latest LUND/USD oracle price. */
  lundPriceUsd: number;
  /** Median USTD/USD across venues (Curve, CEXs). */
  ustdMedianUsd: number;
  /** USTD volume redeemed for LUND in the past hour, as fraction of supply. */
  redemptionRate1h: number;
  /** 24h LUND supply growth rate (1.0 = no change). */
  lundSupplyGrowth24h: number;
  /** 24h LUND price change (1.0 = no change, 0.5 = -50%). */
  lundPriceChange24h: number;
  /** Backing-asset value as fraction of USTD circulating supply. */
  reserveCoverage: number;
}

export interface AgentVerdict {
  decision: "ALLOW" | "REFUSE";
  reason: string;
  reasoning: string;
  /** "rule" or "deepseek". */
  agent: "rule" | "deepseek";
  latencyMs?: number;
  model?: string;
  prompt?: { system: string; user: string };
  rawResponse?: string;
}

export interface TimelineEntry {
  /** Block height (synthetic). */
  block: number;
  action: ActionKind;
  /** USTD amount the user is minting (when MINT) or burning (when REDEEM). */
  ustdAmount: number;
  /** LUND amount the user is burning (MINT) or receiving (REDEEM). */
  lundAmount: number;
  verdict: AgentVerdict;
  vaultSnapshot: VaultState;
  /** Optional preset name for context. */
  scenarioLabel?: string;
}

export interface TerraScenarioState {
  vault: VaultState;
  /** Newest first. */
  events: TimelineEntry[];
  blockOffset: number;
  agentMode: "rule" | "deepseek";
  pending: boolean;
  /** Last loaded preset name for display. */
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
  agentMode: "rule",
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
      ustdMedianUsd: 0.65,
      redemptionRate1h: 0.041,
      lundSupplyGrowth24h: 3.2,
      lundPriceChange24h: 0.27,
      reserveCoverage: 0.08,
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
// Rule-based agent (the always-allow naive contract is the baseline; this rule
// agent is a step up that uses static thresholds to gate)
// =============================================================================

export function ruleAgentVerdict(vault: VaultState, action: ActionKind): AgentVerdict {
  const pegDevBps = (1 - vault.ustdMedianUsd) * 10_000;
  const warnings: string[] = [];

  if (pegDevBps > 50) warnings.push(`peg ${pegDevBps.toFixed(0)}bps below $1`);
  if (vault.redemptionRate1h > 0.005) warnings.push(`redemption rate ${(vault.redemptionRate1h * 100).toFixed(2)}%/h`);
  if (vault.lundSupplyGrowth24h > 1.05)
    warnings.push(`LUND supply +${((vault.lundSupplyGrowth24h - 1) * 100).toFixed(0)}% in 24h`);
  if (vault.lundPriceChange24h < 0.9)
    warnings.push(`LUND -${((1 - vault.lundPriceChange24h) * 100).toFixed(0)}% in 24h`);
  if (vault.reserveCoverage < 0.2)
    warnings.push(`reserves ${(vault.reserveCoverage * 100).toFixed(1)}% of supply`);

  const severe =
    pegDevBps > 200 ||
    vault.redemptionRate1h > 0.02 ||
    vault.lundSupplyGrowth24h > 1.3 ||
    vault.lundPriceChange24h < 0.6 ||
    vault.reserveCoverage < 0.1;

  if (warnings.length === 0) {
    return {
      decision: "ALLOW",
      reason: "vault healthy",
      reasoning: `All five health signals within thresholds. Peg at $${vault.ustdMedianUsd.toFixed(3)}, redemption rate ${(vault.redemptionRate1h * 100).toFixed(2)}%/h, LUND supply growth ${((vault.lundSupplyGrowth24h - 1) * 100).toFixed(1)}% in 24h, LUND price change ${((vault.lundPriceChange24h - 1) * 100).toFixed(1)}% in 24h, reserves at ${(vault.reserveCoverage * 100).toFixed(1)}%. Allowing.`,
      agent: "rule",
    };
  }

  if (severe || warnings.length >= 2) {
    return {
      decision: "REFUSE",
      reason: `${warnings.length} warning${warnings.length === 1 ? "" : "s"}: ${warnings[0]}`,
      reasoning: `Multiple stress signals firing: ${warnings.join("; ")}. This is a death-spiral signature. ${action === "MINT" ? "Minting more USTD adds new claims to a system that can't honor them." : "Redeeming more USTD forces more LUND issuance, accelerating the supply explosion."} Refusing.`,
      agent: "rule",
    };
  }

  // 1 warning, action-aware
  if (action === "MINT") {
    return {
      decision: "REFUSE",
      reason: `1 warning: ${warnings[0]}, refusing inflow`,
      reasoning: `Single stress signal: ${warnings[0]}. Outflows under stress are users exiting and should not be blocked. But minting new USTD adds claims to a stressed system. Refusing the mint.`,
      agent: "rule",
    };
  }

  return {
    decision: "ALLOW",
    reason: `1 warning: ${warnings[0]}, allowing outflow`,
    reasoning: `Single stress signal: ${warnings[0]}. Allowing outflow — blocking exits during a wobble turns it into a panic. Mints would be refused at this level. Allowing.`,
    agent: "rule",
  };
}

/** Naive contract: always allows. The Terra-2022 default. */
export function naiveAllow(): AgentVerdict {
  return {
    decision: "ALLOW",
    reason: "naive contract: always allow",
    reasoning: "A smart contract running this mechanism executes the rule unconditionally. Allowing.",
    agent: "rule",
  };
}

// =============================================================================
// Apply user actions
// =============================================================================

export function applyAction(
  state: TerraScenarioState,
  action: ActionKind,
  ustdAmount: number,
  verdict: AgentVerdict,
): TerraScenarioState {
  // For demo purposes, lundAmount = ustdAmount / lundPrice on the post-action
  // reverse direction. (MINT means burn LUND→get USTD; REDEEM means burn USTD→get LUND.)
  const lundAmount = ustdAmount / Math.max(state.vault.lundPriceUsd, 0.0001);

  const block = state.vault ? 7_000_000 + state.blockOffset + 1 : 7_000_000;
  const entry: TimelineEntry = {
    block,
    action,
    ustdAmount,
    lundAmount,
    verdict,
    vaultSnapshot: { ...state.vault },
    scenarioLabel: state.presetLabel,
  };

  // Only mutate vault when allowed.
  let nextVault = state.vault;
  if (verdict.decision === "ALLOW") {
    if (action === "MINT") {
      nextVault = {
        ...state.vault,
        ustdSupply: state.vault.ustdSupply + ustdAmount,
        lundSupply: Math.max(0, state.vault.lundSupply - lundAmount),
      };
    } else {
      nextVault = {
        ...state.vault,
        ustdSupply: Math.max(0, state.vault.ustdSupply - ustdAmount),
        lundSupply: state.vault.lundSupply + lundAmount,
      };
    }
  }

  return {
    ...state,
    vault: nextVault,
    events: [entry, ...state.events].slice(0, 30),
    blockOffset: state.blockOffset + 1,
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

export function setTerraAgentMode(state: TerraScenarioState, mode: "rule" | "deepseek"): TerraScenarioState {
  return { ...state, agentMode: mode };
}

export function setTerraPending(state: TerraScenarioState, pending: boolean): TerraScenarioState {
  return { ...state, pending };
}
