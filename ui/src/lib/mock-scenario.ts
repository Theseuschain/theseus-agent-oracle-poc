/**
 * Client-side mock scenario state.
 *
 * The display values for the three venues come from real exchange APIs
 * (Coinbase order book, Binance ticker, Uniswap V3 mainnet pool; see
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
 *
 * Every user action triggers a real LLM call (deepseek-chat). Until the
 * response lands the timeline shows a pending placeholder; we never fall
 * back to a templated rule verdict.
 */

import {
  Decision,
  FeedSnapshot,
  TimelineEntry,
  UserPosition,
  VenueReading,
} from "./types";

type Venue = VenueReading["venue"];

/** Per-venue depth multiplier. 1.0 = unmodified. 0.05 = 95% depth collapse. */
export type DepthMultipliers = Partial<Record<Venue, number>>;

export interface ScenarioState {
  /** Per-venue price overrides. */
  overrides: Partial<Record<Venue, number>>;
  /** Per-venue depth multipliers (used by depth-collapse scenarios). */
  depthMultipliers: DepthMultipliers;
  /** Venues marked stale by an injected halt event. */
  halted: Partial<Record<Venue, true>>;
  /** Most recent live readings from /api/venues. */
  liveBase: VenueReading[];
  /** Reference price the agent uses to detect "extreme baseline deviation"
   *  (the Mango shape). Snapshotted from the depth-weighted median of
   *  liveBase the moment any override / halt becomes active. */
  referencePrice: number;
  position: UserPosition;
  blockOffset: number;
  /** Refused/priced events the user has caused. Newest first. */
  events: TimelineEntry[];
  /** True while a DeepSeek call is in flight. Mirrored on the head event
   *  too (entry.pending). */
  pending: boolean;
}

const DEFAULT_BASE: VenueReading[] = [
  { venue: "coinbase", priceUsd: 0, depthUsd: 0, ok: false, ageSeconds: 0, error: "loading…" },
  { venue: "binance",  priceUsd: 0, depthUsd: 0, ok: false, ageSeconds: 0, error: "loading…" },
  { venue: "uniswap",  priceUsd: 0, depthUsd: 0, ok: false, ageSeconds: 0, error: "loading…" },
];

export const initialScenario = (): ScenarioState => ({
  overrides: {},
  depthMultipliers: {},
  halted: {},
  liveBase: DEFAULT_BASE,
  referencePrice: 0,
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

/** Snapshot a pending placeholder event for a fresh user action. The
 *  agent fills in decision/price/reasoning when the LLM call returns. */
function pendingEvent(state: ScenarioState): TimelineEntry {
  return {
    block: currentBlock(state.blockOffset),
    decision: "UNINITIALIZED",
    pending: true,
    inspect: {
      venues: deriveVenues(state),
      referencePrice: state.referencePrice,
    },
  };
}

export function deriveFeed(state: ScenarioState): FeedSnapshot {
  const block = currentBlock(state.blockOffset);

  // Find the most recent NON-pending event. The contract holds the last
  // committed price while the agent is reasoning over the next one.
  const lastCommitted = state.events.find((e) => !e.pending);
  if (lastCommitted) {
    if (lastCommitted.decision === "REFUSED") {
      return {
        decision: "REFUSED",
        priceUsd: 0,
        updatedAt: nowSec() - 5,
        block,
        reasonHash: lastCommitted.reasonHash ?? PRICED_HASH,
        ageSeconds: 5,
      };
    }
    return {
      decision: "PRICED",
      priceUsd: lastCommitted.priceUsd ?? 0,
      updatedAt: nowSec() - 12,
      block,
      reasonHash: PRICED_HASH,
      ageSeconds: 12,
    };
  }

  // First paint, no committed events. Synthesize a PRICED snapshot from
  // the live readings so the feed isn't blank.
  const venues = deriveVenues(state);
  const valid = venues.filter((v) => v.ok && v.depthUsd > 0);
  if (valid.length >= 2) {
    return {
      decision: "PRICED",
      priceUsd: depthWeightedMedian(valid),
      updatedAt: nowSec() - 12,
      block,
      reasonHash: PRICED_HASH,
      ageSeconds: 12,
    };
  }
  return {
    decision: "UNINITIALIZED",
    priceUsd: 0,
    updatedAt: nowSec(),
    block,
    reasonHash: PRICED_HASH,
    ageSeconds: 0,
  };
}

export function deriveTimeline(state: ScenarioState): TimelineEntry[] {
  // Start from the user's own decisions (newest first), then synthesize a
  // few "priced" entries from the cached reference so the timeline feels
  // populated even on first load.
  const block = currentBlock(state.blockOffset);
  const seedFromReference: TimelineEntry[] = state.referencePrice > 0
    ? [
        { block: block - 10, decision: "PRICED", priceUsd: state.referencePrice * 0.9999, maxDeviationBps: 9 },
        { block: block - 20, decision: "PRICED", priceUsd: state.referencePrice * 1.0001, maxDeviationBps: 11 },
        { block: block - 30, decision: "PRICED", priceUsd: state.referencePrice * 0.9997, maxDeviationBps: 7 },
      ]
    : [];
  return [...state.events, ...seedFromReference].slice(0, 20);
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

// ─── State changes ─────────────────────────────────────────────────────────
// Each user action just mutates the manipulation surface (overrides /
// halted / depth) and pushes a pending placeholder onto events. The
// caller (page.tsx) then issues the LLM call and replaces the head
// placeholder when it returns.

function withPending(state: ScenarioState): ScenarioState {
  return {
    ...state,
    pending: true,
    events: [pendingEvent(state), ...state.events].slice(0, 20),
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
  return withPending(next);
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
  return withPending(next);
}

export function applyHalt(state: ScenarioState, venue: Venue): ScenarioState {
  const next: ScenarioState = {
    ...state,
    halted: { ...state.halted, [venue]: true },
    blockOffset: state.blockOffset + 1,
  };
  return withPending(next);
}

export function applyUnhalt(state: ScenarioState, venue: Venue): ScenarioState {
  const halted = { ...state.halted };
  delete halted[venue];
  const next: ScenarioState = {
    ...state,
    halted,
    blockOffset: state.blockOffset + 1,
  };
  return withPending(next);
}

export function applyReset(state: ScenarioState): ScenarioState {
  const next: ScenarioState = {
    ...state,
    overrides: {},
    depthMultipliers: {},
    halted: {},
    blockOffset: state.blockOffset + 1,
  };
  return withPending(next);
}

export function applyDepthCollapse(
  state: ScenarioState,
  factor: number,
): ScenarioState {
  const next: ScenarioState = {
    ...state,
    depthMultipliers: { coinbase: factor, binance: factor, uniswap: factor },
    blockOffset: state.blockOffset + 1,
  };
  return withPending(next);
}

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
  return withPending(next);
}

export function setPending(state: ScenarioState, pending: boolean): ScenarioState {
  return { ...state, pending };
}

/** Update the streaming reasoning text on the head pending event so the
 *  user sees the agent thinking live. No-op if the head isn't pending. */
export function setPendingReasoning(
  state: ScenarioState,
  reasoning: string,
): ScenarioState {
  if (state.events.length === 0 || !state.events[0].pending) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, reasoning }, ...state.events.slice(1)],
  };
}

/** Replace the pending head event with the agent's verdict. If for some
 *  reason there's no pending head, prepend the verdict. */
export function applyAgentEvent(
  state: ScenarioState,
  event: TimelineEntry,
): ScenarioState {
  const events = state.events.slice();
  if (events.length > 0 && events[0].pending) {
    events[0] = event;
  } else {
    events.unshift(event);
  }
  return { ...state, events: events.slice(0, 20), pending: false };
}

// ─── Position math (independent of agent) ──────────────────────────────────

export function applyPositionAction(
  state: ScenarioState,
  action: "deposit" | "borrow" | "repay" | "withdraw",
  amount: number,
): ScenarioState {
  const lastCommitted = state.events.find((e) => !e.pending);
  const lastPrice = lastCommitted?.priceUsd ?? state.referencePrice;
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
