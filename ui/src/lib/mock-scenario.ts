/**
 * Client-side mock scenario state.
 *
 * Owned by the browser (Vercel's serverless functions don't share in-memory
 * state across instances; in-memory globals on the server can't survive a
 * tamper → poll cycle).
 *
 * Three demo paths, each producing a structurally distinct refusal:
 *
 * 1. Tamper one venue (existing) → numerical divergence between the venues.
 *    A 200-line Solidity contract with three Chainlink feeds could catch this.
 *
 * 2. Pump *all* venues to the same manipulated price → no numerical divergence,
 *    but the agent flags it via depth/exitability reasoning. This is the
 *    Mango Markets shape. A contract using a venue-quorum oracle wouldn't
 *    catch it because the quorum agrees.
 *
 * 3. Halt a venue → agent recognizes the venue as stale via off-chain
 *    context (a status-page or news event). A contract has no API for this:
 *    if the oracle keeps reporting the last value, the contract believes it.
 */

import {
  Decision,
  FeedSnapshot,
  TimelineEntry,
  UserPosition,
  VenueReading,
} from "./types";

type Venue = VenueReading["venue"];

export interface ScenarioState {
  /** Per-venue price overrides. */
  overrides: Partial<Record<Venue, number>>;
  /** Venues marked stale by an injected halt event. */
  halted: Partial<Record<Venue, true>>;
  position: UserPosition;
  /** Block height ticks every scenario action so "block N" advances. */
  blockOffset: number;
  /** Refused/priced events the user has caused. Newest first. */
  events: TimelineEntry[];
}

export const initialScenario = (): ScenarioState => ({
  overrides: {},
  halted: {},
  blockOffset: 0,
  events: [],
  position: {
    collateralWeth: 0,
    collateralUsd: 0,
    debtUsdc: 0,
    debtUsd: 0,
    healthFactor: Infinity,
    ltv: 0,
  },
});

const REFERENCE_PRICE = 3502.4;
const PRICED_HASH = `0x${"0".repeat(64)}`;
const REFUSED_HASH_DIVERGENCE =
  "0x8a3f7b2c4d5e6f819203a4b5c6d7e8f90123456789abcdef0123456789abcdef";
const REFUSED_HASH_EXITABILITY =
  "0xb7e2c9f1a4d6e8093215c4d7e8f901234abcdef56789012345678901234abcdef";
const REFUSED_HASH_HALT =
  "0xc1d4e7a0b3f6c8092145c7d8e9f01234567890abcdef0123456789abcdef0123";

const SEED_TIMELINE: Omit<TimelineEntry, "block">[] = [
  { decision: "PRICED", priceUsd: 3502.41, maxDeviationBps: 12 },
  { decision: "PRICED", priceUsd: 3499.07, maxDeviationBps: 8 },
  { decision: "PRICED", priceUsd: 3495.22, maxDeviationBps: 15 },
  { decision: "PRICED", priceUsd: 3498.10, maxDeviationBps: 6 },
  { decision: "PRICED", priceUsd: 3501.94, maxDeviationBps: 11 },
];

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

const BASE_DEPTH: Record<Venue, number> = {
  coinbase: 48_200_000,
  binance:  1_500_000_000,
  uniswap:  215_000_000,
};

const BASE_PRICE: Record<Venue, number> = {
  coinbase: 3502.40,
  binance:  3502.51,
  uniswap:  3498.12,
};

const BASE_AGE: Record<Venue, number> = {
  coinbase: 4,
  binance:  8,
  uniswap:  14,
};

export function deriveVenues(state: ScenarioState): VenueReading[] {
  return (Object.keys(BASE_PRICE) as Venue[]).map((v) => {
    const halted = !!state.halted[v];
    const override = state.overrides[v];
    return {
      venue: v,
      priceUsd: override ?? BASE_PRICE[v],
      depthUsd: BASE_DEPTH[v],
      ok: !halted,
      ageSeconds: halted ? Math.max(BASE_AGE[v], 60) : BASE_AGE[v],
      tampered: override !== undefined,
      ...(halted ? { error: "halted: trading suspended" } : {}),
    };
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
 * a structurally different reasoning paragraph — that's the whole point.
 */
export function analyze(state: ScenarioState): RefusalAnalysis {
  const venues = deriveVenues(state);
  const valid = venues.filter((v) => v.ok);
  const haltedVenues = venues.filter((v) => !v.ok);

  // Rule 1 — insufficient venues (context-derived staleness)
  if (valid.length < 2) {
    const haltedNames = haltedVenues.map((v) => VENUE_LABEL[v.venue]).join(", ");
    return {
      decision: "REFUSED",
      reason: `insufficient_venues: ${valid.length}/3 active`,
      reasonHash: REFUSED_HASH_HALT,
      reasoning: [
        `${haltedNames} ${haltedVenues.length === 1 ? "is" : "are"} reporting halted trading via off-chain status events.`,
        `That leaves ${valid.length} active venue${valid.length === 1 ? "" : "s"} — below the policy minimum of 2 independent reads.`,
        `A smart contract using a stale Chainlink feed would have no signal that an exchange has halted; the feed keeps reporting whatever was last submitted.`,
        `Refusing until at least 2 venues recover.`,
      ].join(" "),
    };
  }

  // Compute the depth-weighted median across active venues.
  const totalDepth = valid.reduce((s, v) => s + v.depthUsd, 0);
  const median = valid.reduce((s, v) => s + (v.priceUsd * v.depthUsd) / totalDepth, 0);

  // Rule 2 — exitability / extreme baseline deviation (Mango shape).
  // Fires when prices have moved >50% from the historical reference even if
  // the active venues all agree. The Mango exploit pumped every input venue
  // simultaneously; numerical divergence rules saw nothing.
  const baselineDeviation = Math.abs(median - REFERENCE_PRICE) / REFERENCE_PRICE;
  if (baselineDeviation > 0.5) {
    const moveX = (median / REFERENCE_PRICE).toFixed(1);
    const reportedDepth = (totalDepth / 1e9).toFixed(2);
    return {
      decision: "REFUSED",
      reason: `exitability: ${moveX}x move with insufficient real depth`,
      reasonHash: REFUSED_HASH_EXITABILITY,
      reasoning: [
        `All ${valid.length} active venues report ~$${median.toFixed(0)} — they all moved together to the same level (zero numerical divergence between feeds).`,
        `A naïve venue-quorum oracle would price this.`,
        `But cumulative depth across these venues is $${reportedDepth}B, unchanged from the pre-move baseline. Real liquidity doesn't materialize at synthetic prices — if a $100M position were liquidated at $${median.toFixed(0)}, it would clear the entire visible book.`,
        `This pattern matches Mango Markets (Oct 2022, $116M) and Bybit MNGO (2023): a coordinated mark-pump where every reporting venue was the same shallow pool.`,
        `A smart contract reading three Chainlink feeds that all agree has no rule to fire here. Refusing.`,
      ].join(" "),
      reportedPrice: median,
    };
  }

  // Rule 3 — numerical divergence (existing single-venue tamper).
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
        `${VENUE_LABEL[worst.venue]} reports $${worst.priceUsd.toFixed(2)}; ${VENUE_LABEL[reference.venue]} reports $${reference.priceUsd.toFixed(2)} — divergence of ${direction}, far above the 50bps policy threshold.`,
        `Cross-venue spreads on ETH/USD normally sit at single-digit bps; this size of disagreement is the signature of a flash-loan-manipulated AMM or a thin-book pump on a single venue.`,
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
  const a = analyze(state);
  const block = currentBlock(state.blockOffset);
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
    priceUsd: a.reportedPrice ?? 3502.41,
    updatedAt: nowSec() - 12,
    block,
    reasonHash: PRICED_HASH,
    ageSeconds: 12,
  };
}

export function deriveTimeline(state: ScenarioState): TimelineEntry[] {
  const block = currentBlock(state.blockOffset);
  const seed: TimelineEntry[] = SEED_TIMELINE.map((entry, i) => ({
    ...entry,
    block: block - (i + 1) * 10,
    reasoning: `3 venues reconciled to within ${entry.maxDeviationBps}bps of depth-weighted median.`,
  }));
  return [...state.events, ...seed].slice(0, 20);
}

function recordEvent(state: ScenarioState): TimelineEntry {
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
    halted: {},
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
  const lastPrice = a.reportedPrice ?? 3502.41;
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
