/**
 * Sovereign fund demo state.
 *
 * Models a fully autonomous on-chain fund that holds USDC + WETH, runs its
 * own decision loop on a schedule, and rebalances between the two assets
 * based on market conditions and its own written mandate. No human or
 * external contract calls it; the agent triggers itself.
 *
 * This is the opposite shape from the gate-style agents (Aave Oracle,
 * Terra Failsafe, Bridge Guardian) and the verdict-style agents
 * (Governance Reviewer, Aviation Safety Reviewer, Prediction Market
 * Adjudicator). Those wait to be asked. The sovereign fund acts.
 *
 * Execution is mocked here: the contract surface (SovereignFund.sol)
 * holds the position state, the agent posts decisions and the demo
 * applies them to the in-memory portfolio. A production deployment
 * would wire the execute() function to a DEX router.
 */

export type FundAction = "HOLD" | "BUY_WETH" | "SELL_WETH";

export interface FundPortfolio {
  /** USDC held by the fund (6 decimals abstracted as a regular number). */
  usdc: number;
  /** WETH held by the fund. */
  weth: number;
}

export interface MarketSnapshot {
  /** Current WETH/USDC mid-price. */
  wethPriceUsd: number;
  /** 24-hour return ratio. 1.0 means flat. 1.05 means +5%. */
  ret24h: number;
  /** 7-day return ratio. */
  ret7d: number;
  /** Annualized realized vol over the last 24h, as a percentage. */
  realizedVolPct: number;
  /** Macro-context note. Free text; agent reads it. */
  macroNote: string;
}

export interface FundAgentDecision {
  action: FundAction;
  /** USD-equivalent size of the action. For HOLD this is 0. */
  sizeUsd: number;
  reason: string;
  reasoning: string;
  latencyMs?: number;
  model?: string;
  prompt?: { system: string; user: string };
  rawResponse?: string;
}

export interface FundTimelineEntry {
  block: number;
  marketSnapshot: MarketSnapshot;
  portfolioBefore: FundPortfolio;
  portfolioAfter?: FundPortfolio;
  decision?: FundAgentDecision;
  pending?: boolean;
  streamingReasoning?: string;
  scenarioLabel?: string;
}

export interface FundScenarioState {
  portfolio: FundPortfolio;
  market: MarketSnapshot;
  events: FundTimelineEntry[];
  blockOffset: number;
  pending: boolean;
  presetLabel: string;
}

/** Starting NAV: $1M, 50-50 by USD value. */
export const STARTING_PORTFOLIO: FundPortfolio = {
  usdc: 500_000,
  weth: 500_000 / 2500, // 200 WETH at $2,500
};

export const CALM_MARKET: MarketSnapshot = {
  wethPriceUsd: 2500,
  ret24h: 1.002,
  ret7d: 1.012,
  realizedVolPct: 18,
  macroNote: "No notable macro events. Range-bound on most majors.",
};

export const initialFundScenario = (): FundScenarioState => ({
  portfolio: { ...STARTING_PORTFOLIO },
  market: { ...CALM_MARKET },
  events: [],
  blockOffset: 0,
  pending: false,
  presetLabel: "Calm",
});

export const FUND_PRESETS: Record<
  string,
  { label: string; description: string; market: MarketSnapshot }
> = {
  calm: {
    label: "Calm",
    description:
      "Range-bound spot, low realized vol (~18% annualized), gentle 24h drift. The do-nothing baseline.",
    market: { ...CALM_MARKET },
  },
  bullTrend: {
    label: "Bull trend",
    description:
      "Sustained upward move: +18% over 7d, +3% in last 24h, vol contracting. Trend-following mandate would want to tilt to WETH.",
    market: {
      wethPriceUsd: 2950,
      ret24h: 1.031,
      ret7d: 1.182,
      realizedVolPct: 22,
      macroNote:
        "Risk-on rotation in the last 10 days; equities making 6-month highs.",
    },
  },
  drawdown: {
    label: "Sharp drawdown",
    description:
      "WETH down 9% in 24h on no specific catalyst. Realized vol spiked from 22% to 55%. Defensive-tilt mandate would reduce WETH.",
    market: {
      wethPriceUsd: 2275,
      ret24h: 0.91,
      ret7d: 0.93,
      realizedVolPct: 55,
      macroNote:
        "Cross-asset risk-off; sharp moves in DXY and rates. No single named catalyst.",
    },
  },
  blackSwan: {
    label: "Black swan",
    description:
      "20% gap-down overnight on a macro shock. Vol annualizes to 120%+. Capital-preservation mandate should be at maximum USDC.",
    market: {
      wethPriceUsd: 2000,
      ret24h: 0.8,
      ret7d: 0.82,
      realizedVolPct: 125,
      macroNote:
        "Major unscheduled central-bank action; cross-asset volatility everywhere. Treat as regime change until proven otherwise.",
    },
  },
};

export function applyFundPendingTick(
  state: FundScenarioState,
): FundScenarioState {
  const block = 7_000_000 + state.blockOffset + 1;
  const entry: FundTimelineEntry = {
    block,
    pending: true,
    marketSnapshot: { ...state.market },
    portfolioBefore: { ...state.portfolio },
    scenarioLabel: state.presetLabel,
  };
  return {
    ...state,
    events: [entry, ...state.events].slice(0, 30),
    blockOffset: state.blockOffset + 1,
    pending: true,
  };
}

function applyDecisionToPortfolio(
  portfolio: FundPortfolio,
  decision: FundAgentDecision,
  price: number,
): FundPortfolio {
  if (decision.action === "HOLD" || decision.sizeUsd <= 0) {
    return { ...portfolio };
  }
  const sizeUsd = decision.sizeUsd;
  if (decision.action === "BUY_WETH") {
    const usdSpend = Math.min(sizeUsd, portfolio.usdc);
    return {
      usdc: portfolio.usdc - usdSpend,
      weth: portfolio.weth + usdSpend / price,
    };
  }
  // SELL_WETH
  const wethSell = Math.min(sizeUsd / price, portfolio.weth);
  return {
    usdc: portfolio.usdc + wethSell * price,
    weth: portfolio.weth - wethSell,
  };
}

export function applyFundDecision(
  state: FundScenarioState,
  decision: FundAgentDecision,
): FundScenarioState {
  if (state.events.length === 0 || !state.events[0].pending) {
    return { ...state, pending: false };
  }
  const head = state.events[0];
  const portfolioAfter = applyDecisionToPortfolio(
    state.portfolio,
    decision,
    state.market.wethPriceUsd,
  );
  const finalized: FundTimelineEntry = {
    ...head,
    pending: false,
    decision,
    portfolioAfter,
    streamingReasoning: undefined,
  };
  return {
    ...state,
    portfolio: portfolioAfter,
    events: [finalized, ...state.events.slice(1)],
    pending: false,
  };
}

export function applyFundPreset(
  state: FundScenarioState,
  presetKey: keyof typeof FUND_PRESETS,
): FundScenarioState {
  const p = FUND_PRESETS[presetKey];
  return {
    ...state,
    market: { ...p.market },
    presetLabel: p.label,
    blockOffset: state.blockOffset + 1,
  };
}

export function setFundPending(
  state: FundScenarioState,
  pending: boolean,
): FundScenarioState {
  return { ...state, pending };
}

export function setFundPendingReasoning(
  state: FundScenarioState,
  reasoning: string,
): FundScenarioState {
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

/** Total portfolio value in USD at the given price. */
export function navUsd(portfolio: FundPortfolio, price: number): number {
  return portfolio.usdc + portfolio.weth * price;
}

/** USDC weight of the portfolio (0-1). */
export function usdcWeight(portfolio: FundPortfolio, price: number): number {
  const nav = navUsd(portfolio, price);
  if (nav <= 0) return 0;
  return portfolio.usdc / nav;
}
