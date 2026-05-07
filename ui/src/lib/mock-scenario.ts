/**
 * Client-side mock scenario state.
 *
 * The display values for the three venues come from real exchange APIs
 * (Coinbase order book, Binance ticker, Uniswap V3 mainnet pool — see
 * /api/venues). Tamper / halt overrides are layered on top in React state.
 *
 * Three demo paths, each producing a structurally distinct refusal:
 *
 * 1. Tamper one venue → numerical divergence between the venues.
 *    A 200-line Solidity contract with three Chainlink feeds could catch this.
 *
 * 2. Pump *all* venues to the same manipulated price → no numerical divergence,
 *    but the agent flags it via depth/exitability reasoning. This is the
 *    Mango Markets shape. A contract using a venue-quorum oracle wouldn't
 *    catch it because the quorum agrees.
 *
 * 3. Halt a venue → agent recognizes the venue as stale via off-chain
 *    context (a status-page or news event). A contract has no API for this.
 */

import {
  Decision,
  FeedSnapshot,
  TimelineEntry,
  UserPosition,
  VenueReading,
} from "./types";

type Venue = VenueReading["venue"];

export type AgentMode = "rule" | "deepseek";

/** Per-venue depth multiplier. 1.0 = unmodified. 0.05 = 95% depth collapse. */
export type DepthMultipliers = Partial<Record<Venue, number>>;

export interface ScenarioState {
  /** Which agent is making the decisions. */
  agentMode: AgentMode;
  /** Per-venue price overrides. */
  overrides: Partial<Record<Venue, number>>;
  /** Per-venue depth multipliers (used by depth-collapse scenarios). */
  depthMultipliers: DepthMultipliers;
  /** Venues marked stale by an injected halt event. */
  halted: Partial<Record<Venue, true>>;
  /** Most recent live readings from /api/venues. Used as the base values
   *  the venue cards display when no override / halt is active. */
  liveBase: VenueReading[];
  /** Reference price the agent uses to detect "extreme baseline deviation"
   *  (the Mango shape). Snapshotted from the depth-weighted median of
   *  liveBase the moment any override / halt becomes active, so the demo's
   *  comparison is against the price the chain saw before manipulation. */
  referencePrice: number;
  position: UserPosition;
  /** Block height ticks every scenario action so "block N" advances. */
  blockOffset: number;
  /** Refused/priced events the user has caused. Newest first. */
  events: TimelineEntry[];
  /** True while a DeepSeek call is in flight. */
  pending: boolean;
}

const DEFAULT_BASE: VenueReading[] = [
  { venue: "coinbase", priceUsd: 0, depthUsd: 0, ok: false, ageSeconds: 0, error: "loading…" },
  { venue: "binance",  priceUsd: 0, depthUsd: 0, ok: false, ageSeconds: 0, error: "loading…" },
  { venue: "uniswap",  priceUsd: 0, depthUsd: 0, ok: false, ageSeconds: 0, error: "loading…" },
];

export const initialScenario = (): ScenarioState => ({
  agentMode: "rule",
  overrides: {},
  depthMultipliers: {},
  halted: {},
  liveBase: DEFAULT_BASE,
  referencePrice: 0, // populated on first /api/venues poll
  blockOffset: 0,
  events: [],
  pending: false,
  position: {
    collateralWeth: 0,
    collateralUsd: 0,
    debtUsdc: 0,
    debtUsd: 0,
    healthFactor: Infinity,
    ltv: 0,
  },
});

export const PRICED_HASH = `0x${"0".repeat(64)}`;
export const REFUSED_HASH_DIVERGENCE =
  "0x8a3f7b2c4d5e6f819203a4b5c6d7e8f90123456789abcdef0123456789abcdef";
export const REFUSED_HASH_EXITABILITY =
  "0xb7e2c9f1a4d6e8093215c4d7e8f901234abcdef56789012345678901234abcdef";
export const REFUSED_HASH_HALT =
  "0xc1d4e7a0b3f6c8092145c7d8e9f01234567890abcdef0123456789abcdef0123";

/** Map a refusal reason string to one of the canonical refusal hashes.
 *  Used when an LLM decision needs an on-chain-shaped hash to display. */
export function hashForReason(decision: "PRICED" | "REFUSED", reason: string): string {
  if (decision === "PRICED") return PRICED_HASH;
  const r = reason.toLowerCase();
  if (/exitability|mango|depth/.test(r)) return REFUSED_HASH_EXITABILITY;
  if (/insufficient|halt|stale/.test(r)) return REFUSED_HASH_HALT;
  return REFUSED_HASH_DIVERGENCE;
}

const VENUE_LABEL: Record<Venue, string> = {
  coinbase: "Coinbase",
  binance: "Binance",
  uniswap: "Uniswap V3",
};

function currentBlock(offset: number): number {
  return 5_513_807 + offset * 10;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function depthWeightedMedian(readings: VenueReading[]): number {
  const valid = readings.filter((r) => r.ok && r.depthUsd > 0);
  if (valid.length === 0) return 0;
  const total = valid.reduce((s, r) => s + r.depthUsd, 0);
  return valid.reduce((s, r) => s + (r.priceUsd * r.depthUsd) / total, 0);
}

export function deriveVenues(state: ScenarioState): VenueReading[] {
  return state.liveBase.map((base) => {
    const v = base.venue;
    const halted = !!state.halted[v];
    const override = state.overrides[v];
    const depthMul = state.depthMultipliers[v];
    if (halted) {
      return {
        ...base,
        ok: false,
        error: "halted: trading suspended",
        ageSeconds: Math.max(base.ageSeconds, 60),
      };
    }
    let r: VenueReading = base;
    if (override !== undefined) {
      r = { ...r, priceUsd: override, ok: true, tampered: true, error: undefined };
    }
    if (depthMul !== undefined) {
      r = { ...r, depthUsd: r.depthUsd * depthMul, tampered: true };
    }
    return r;
  });
}

interface RefusalAnalysis {
  decision: Decision;
  reason: string;
  reasonHash: string;
  reasoning: string;
  reportedPrice?: number;
  maxDeviationBps?: number;
}

/**
 * The agent's reconciliation policy. Three rules, in order. Each fires with
 * a structurally different reasoning paragraph.
 */
export function analyze(state: ScenarioState): RefusalAnalysis {
  const venues = deriveVenues(state);
  const valid = venues.filter((v) => v.ok);
  const haltedVenues = venues.filter((v) => !v.ok);

  // Rule 1: insufficient venues (context-derived staleness)
  if (valid.length < 2) {
    const haltedNames = haltedVenues.map((v) => VENUE_LABEL[v.venue]).join(", ");
    return {
      decision: "REFUSED",
      reason: `insufficient_venues: ${valid.length}/3 active`,
      reasonHash: REFUSED_HASH_HALT,
      reasoning: [
        `${haltedNames} ${haltedVenues.length === 1 ? "is" : "are"} reporting halted trading via off-chain status events.`,
        `That leaves ${valid.length} active venue${valid.length === 1 ? "" : "s"}, below the policy minimum of 2 independent reads.`,
        `A smart contract using a stale Chainlink feed would have no signal that an exchange has halted; the feed keeps reporting whatever was last submitted.`,
        `Refusing until at least 2 venues recover.`,
      ].join(" "),
    };
  }

  const median = depthWeightedMedian(valid);

  // Rule 2 — exitability / extreme baseline deviation (Mango shape).
  // Only fires when the venues actually AGREE on the manipulated price —
  // that's the signature of a coordinated mark-pump where every reporting
  // venue is the same shallow pool. Single-venue tampers should fall
  // through to Rule 3 (numerical divergence).
  if (state.referencePrice > 0 && valid.length >= 2) {
    const minP = Math.min(...valid.map((v) => v.priceUsd));
    const maxP = Math.max(...valid.map((v) => v.priceUsd));
    const venueSpread = minP > 0 ? (maxP - minP) / minP : Infinity;
    const venuesAgree = venueSpread < 0.05; // within 5% of each other
    const baselineDeviation = Math.abs(median - state.referencePrice) / state.referencePrice;
    if (venuesAgree && baselineDeviation > 0.5) {
      const moveX = (median / state.referencePrice).toFixed(1);
      const totalDepth = valid.reduce((s, v) => s + v.depthUsd, 0);
      const reportedDepthFmt =
        totalDepth >= 1e9 ? `$${(totalDepth / 1e9).toFixed(2)}B`
        : totalDepth >= 1e6 ? `$${(totalDepth / 1e6).toFixed(1)}M`
        : `$${totalDepth.toFixed(0)}`;
      return {
        decision: "REFUSED",
        reason: `exitability: ${moveX}x move with insufficient real depth`,
        reasonHash: REFUSED_HASH_EXITABILITY,
        reasoning: [
          `All ${valid.length} active venues report ~$${median.toFixed(0)}, sitting at the same level (zero numerical divergence between feeds).`,
          `A venue-quorum oracle would price this.`,
          `But cumulative depth across these venues is ${reportedDepthFmt}, unchanged from the pre-move baseline (~$${state.referencePrice.toFixed(0)}). Real liquidity doesn't materialize at synthetic prices. A $100M liquidation at $${median.toFixed(0)} would clear the entire visible book.`,
          `This pattern matches Mango Markets (Oct 2022, $116M) and Bybit MNGO (2023): a coordinated mark-pump where every reporting venue was the same shallow pool.`,
          `A smart contract reading three Chainlink feeds that all agree has no rule to fire here. Refusing.`,
        ].join(" "),
        reportedPrice: median,
      };
    }
  }

  // Rule 3 — numerical divergence (single-venue tamper).
  let maxDev = 0;
  let worst: VenueReading | null = null;
  for (const v of valid) {
    const dev = Math.abs(v.priceUsd - median) / median;
    if (dev > maxDev) {
      maxDev = dev;
      worst = v;
    }
  }
  if (worst && maxDev > 0.005) {
    const reference = valid.find((v) => v !== worst) ?? worst;
    const ratio = worst.priceUsd / reference.priceUsd;
    const direction =
      ratio >= 2 ? `${ratio.toFixed(1)}×`
      : ratio <= 0.5 ? `${(1 / ratio).toFixed(1)}× below`
      : `${Math.abs((ratio - 1) * 100).toFixed(1)}%`;
    const reasonShort = `${worst.venue} divergent from ${reference.venue} by ${direction}`;
    return {
      decision: "REFUSED",
      reason: reasonShort,
      reasonHash: REFUSED_HASH_DIVERGENCE,
      reasoning: [
        `${VENUE_LABEL[worst.venue]} reports $${worst.priceUsd.toFixed(2)}, ${VENUE_LABEL[reference.venue]} reports $${reference.priceUsd.toFixed(2)}. That is a divergence of ${direction}, far above the 50bps policy threshold.`,
        `Cross-venue spreads on ETH/USD normally sit at single-digit bps. Disagreement at this scale is the signature of a flash-loan-manipulated AMM or a thin-book pump on a single venue.`,
        `Refusing until the readings reconcile.`,
      ].join(" "),
      maxDeviationBps: maxDev * 10000,
    };
  }

  // Priced.
  const maxDevBps = maxDev * 10000;
  return {
    decision: "PRICED",
    reason: `priced: median ${median.toFixed(2)}, max deviation ${maxDevBps.toFixed(0)}bps`,
    reasonHash: PRICED_HASH,
    reasoning: `${valid.length} venues reconciled to within ${maxDevBps.toFixed(0)}bps of depth-weighted median. Pricing $${median.toFixed(2)}.`,
    reportedPrice: median,
    maxDeviationBps: maxDevBps,
  };
}

export function deriveFeed(state: ScenarioState): FeedSnapshot {
  const block = currentBlock(state.blockOffset);

  // After the first user-triggered action, the head event is authoritative —
  // it carries either the rule-based or the DeepSeek decision (DeepSeek
  // having replaced the rule event when it returned). The feed reflects it.
  if (state.events.length > 0) {
    const head = state.events[0];
    if (head.decision === "REFUSED") {
      return {
        decision: "REFUSED",
        priceUsd: 0,
        updatedAt: nowSec() - 5,
        block,
        reasonHash: head.reasonHash ?? PRICED_HASH,
        ageSeconds: 5,
      };
    }
    return {
      decision: "PRICED",
      priceUsd: head.priceUsd ?? 0,
      updatedAt: nowSec() - 12,
      block,
      reasonHash: PRICED_HASH,
      ageSeconds: 12,
    };
  }

  // First paint — fall back to a synchronous rule-based read so the feed
  // shows a price from the live venues immediately.
  const a = analyze(state);
  if (a.decision === "REFUSED") {
    return {
      decision: "REFUSED",
      priceUsd: 0,
      updatedAt: nowSec() - 5,
      block,
      reasonHash: a.reasonHash,
      ageSeconds: 5,
    };
  }
  return {
    decision: "PRICED",
    priceUsd: a.reportedPrice ?? 0,
    updatedAt: nowSec() - 12,
    block,
    reasonHash: PRICED_HASH,
    ageSeconds: 12,
  };
}

export function deriveTimeline(state: ScenarioState): TimelineEntry[] {
  // Start from the user's own decisions (newest first), then synthesize a
  // few "priced" entries from the cached reference so the timeline feels
  // populated even on first load.
  const block = currentBlock(state.blockOffset);
  const seedFromReference: TimelineEntry[] = state.referencePrice > 0
    ? [
        { block: block - 10, decision: "PRICED", priceUsd: state.referencePrice * 0.9999, maxDeviationBps: 9, reasoning: `3 venues reconciled to within 9bps of $${state.referencePrice.toFixed(2)}.` },
        { block: block - 20, decision: "PRICED", priceUsd: state.referencePrice * 1.0001, maxDeviationBps: 11, reasoning: `3 venues reconciled to within 11bps.` },
        { block: block - 30, decision: "PRICED", priceUsd: state.referencePrice * 0.9997, maxDeviationBps: 7, reasoning: `3 venues reconciled to within 7bps.` },
      ]
    : [];
  return [...state.events, ...seedFromReference].slice(0, 20);
}

function recordEvent(state: ScenarioState, scenarioHint?: string): TimelineEntry {
  const a = analyze(state);
  const block = currentBlock(state.blockOffset + 1);
  return {
    block,
    decision: a.decision,
    priceUsd: a.reportedPrice,
    maxDeviationBps: a.maxDeviationBps,
    reason: a.reason,
    reasonHash: a.reasonHash,
    reasoning: a.reasoning,
    inspect: {
      venues: deriveVenues(state),
      referencePrice: state.referencePrice,
      scenarioHint,
      agent: "rule",
    },
  };
}

/**
 * Update the cached live readings from a fresh /api/venues response.
 * Snapshots the reference price the first time we see clean readings; after
 * that, only updates the reference when there are no overrides/halts active
 * (so the Mango-shape comparison stays anchored to the pre-tamper price).
 */
export function applyLiveReadings(
  state: ScenarioState,
  liveBase: VenueReading[],
): ScenarioState {
  const dirty =
    Object.keys(state.overrides).length > 0 || Object.keys(state.halted).length > 0;
  const validBase = liveBase.filter((r) => r.ok);
  const newReference = validBase.length >= 2
    ? depthWeightedMedian(validBase)
    : state.referencePrice;
  return {
    ...state,
    liveBase,
    referencePrice: dirty ? state.referencePrice : newReference,
  };
}

export function applyTamper(
  state: ScenarioState,
  venue: Venue,
  priceUsd: number,
): ScenarioState {
  const next: ScenarioState = {
    ...state,
    overrides: { ...state.overrides, [venue]: priceUsd },
    blockOffset: state.blockOffset + 1,
  };
  return { ...next, events: [recordEvent(next), ...state.events].slice(0, 20) };
}

export function applyPumpAll(
  state: ScenarioState,
  priceUsd: number,
): ScenarioState {
  const next: ScenarioState = {
    ...state,
    overrides: { coinbase: priceUsd, binance: priceUsd, uniswap: priceUsd },
    blockOffset: state.blockOffset + 1,
  };
  return { ...next, events: [recordEvent(next), ...state.events].slice(0, 20) };
}

export function applyHalt(state: ScenarioState, venue: Venue): ScenarioState {
  const next: ScenarioState = {
    ...state,
    halted: { ...state.halted, [venue]: true },
    blockOffset: state.blockOffset + 1,
  };
  return { ...next, events: [recordEvent(next), ...state.events].slice(0, 20) };
}

export function applyUnhalt(state: ScenarioState, venue: Venue): ScenarioState {
  const halted = { ...state.halted };
  delete halted[venue];
  const next: ScenarioState = {
    ...state,
    halted,
    blockOffset: state.blockOffset + 1,
  };
  return { ...next, events: [recordEvent(next), ...state.events].slice(0, 20) };
}

export function applyReset(state: ScenarioState): ScenarioState {
  const next: ScenarioState = {
    ...state,
    overrides: {},
    depthMultipliers: {},
    halted: {},
    blockOffset: state.blockOffset + 1,
  };
  return { ...next, events: [recordEvent(next), ...state.events].slice(0, 20) };
}

export function setAgentMode(state: ScenarioState, mode: AgentMode): ScenarioState {
  return { ...state, agentMode: mode };
}

export function setPending(state: ScenarioState, pending: boolean): ScenarioState {
  return { ...state, pending };
}

/** Apply a parsed LLM decision to the scenario as a new timeline event,
 *  but without further mutating overrides — those are still controlled by
 *  the existing tamper/halt actions that triggered the decision. */
export function applyLLMEvent(
  state: ScenarioState,
  event: TimelineEntry,
): ScenarioState {
  return {
    ...state,
    events: [event, ...state.events].slice(0, 20),
    pending: false,
  };
}

/** Parametric scenario constructors used by the demo's "black-swan" buttons.
 *  Each builds a multiplicative override on top of the live base readings,
 *  so the resulting state is grounded in the actual current ETH price. */
export function applyDepthCollapse(
  state: ScenarioState,
  factor: number, // e.g. 0.05 = depth drops to 5% of normal
): ScenarioState {
  const next: ScenarioState = {
    ...state,
    depthMultipliers: { coinbase: factor, binance: factor, uniswap: factor },
    blockOffset: state.blockOffset + 1,
  };
  return { ...next, events: [recordEvent(next), ...state.events].slice(0, 20) };
}

/** Pump every venue by the same multiplier, holding depth constant. Used for
 *  "just-under-threshold" and "real flash crash" scenarios. The agent has to
 *  reason about whether the move is plausible given the depth that didn't
 *  follow it. */
export function applyProportionalMove(
  state: ScenarioState,
  multiplier: number,
): ScenarioState {
  const validBase = state.liveBase.filter((r) => r.ok);
  if (validBase.length === 0) return state;
  const overrides: Partial<Record<Venue, number>> = {};
  for (const v of validBase) {
    overrides[v.venue] = v.priceUsd * multiplier;
  }
  const next: ScenarioState = {
    ...state,
    overrides,
    blockOffset: state.blockOffset + 1,
  };
  return { ...next, events: [recordEvent(next), ...state.events].slice(0, 20) };
}

export function applyPositionAction(
  state: ScenarioState,
  action: "deposit" | "borrow" | "repay" | "withdraw",
  amount: number,
): ScenarioState {
  const a = analyze(state);
  const lastPrice = a.reportedPrice ?? state.referencePrice;
  const p = { ...state.position };

  if (action === "deposit") p.collateralWeth += amount;
  else if (action === "withdraw") p.collateralWeth = Math.max(0, p.collateralWeth - amount);
  else if (action === "borrow") p.debtUsdc += amount;
  else if (action === "repay") p.debtUsdc = Math.max(0, p.debtUsdc - amount);

  p.collateralUsd = p.collateralWeth * lastPrice;
  p.debtUsd = p.debtUsdc;
  p.healthFactor = p.debtUsd > 0 ? (p.collateralUsd * 0.85) / p.debtUsd : Infinity;
  p.ltv = p.collateralUsd > 0 ? p.debtUsd / p.collateralUsd : 0;

  return { ...state, position: p };
}
