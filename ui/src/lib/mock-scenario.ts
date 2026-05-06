/**
 * Client-side mock scenario state.
 *
 * Owned by the browser, not the server. Vercel's serverless functions don't
 * share in-memory state across instances, so module-level globals on the
 * server can't survive a tamper → poll cycle. The client is a stable home
 * for the demo state and avoids the need to provision Redis / KV for what
 * is conceptually a per-tab scenario.
 */

import {
  Decision,
  FeedSnapshot,
  TimelineEntry,
  UserPosition,
  VenueReading,
} from "./types";

export interface ScenarioState {
  tamperedVenue: VenueReading["venue"] | null;
  tamperedPrice: number | null;
  position: UserPosition;
  // Block height ticks every poll cycle so "block N" feels live.
  blockOffset: number;
  // Refusal/priced events the user has caused. Newest first.
  events: TimelineEntry[];
}

export const initialScenario = (): ScenarioState => ({
  tamperedVenue: null,
  tamperedPrice: null,
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
const REFUSED_HASH =
  "0x8a3f7b2c4d5e6f819203a4b5c6d7e8f90123456789abcdef0123456789abcdef";
const PRICED_HASH = `0x${"0".repeat(64)}`;

const SEED_TIMELINE: Omit<TimelineEntry, "block">[] = [
  { decision: "PRICED", priceUsd: 3502.41, maxDeviationBps: 12 },
  { decision: "PRICED", priceUsd: 3499.07, maxDeviationBps: 8 },
  { decision: "PRICED", priceUsd: 3495.22, maxDeviationBps: 15 },
  { decision: "PRICED", priceUsd: 3498.10, maxDeviationBps: 6 },
  { decision: "PRICED", priceUsd: 3501.94, maxDeviationBps: 11 },
];

function currentBlock(offset: number): number {
  // Stable-ish base (advances only via offset). Avoids hydration mismatches
  // from Date.now() differences between server-render and first client paint.
  return 5_513_807 + offset * 10;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function deriveFeed(state: ScenarioState): FeedSnapshot {
  const block = currentBlock(state.blockOffset);
  if (state.tamperedVenue && state.tamperedPrice !== null) {
    return {
      decision: "REFUSED" as Decision,
      priceUsd: 0,
      updatedAt: nowSec() - 5,
      block,
      reasonHash: REFUSED_HASH,
      ageSeconds: 5,
    };
  }
  const lastPriced = state.events.find((e) => e.decision === "PRICED")
    ?? SEED_TIMELINE[0];
  return {
    decision: "PRICED" as Decision,
    priceUsd: lastPriced.priceUsd ?? 3502.41,
    updatedAt: nowSec() - 12,
    block,
    reasonHash: PRICED_HASH,
    ageSeconds: 12,
  };
}

export function deriveVenues(state: ScenarioState): VenueReading[] {
  const base: VenueReading[] = [
    { venue: "coinbase", priceUsd: 3502.4, depthUsd: 48_200_000, ok: true, ageSeconds: 4 },
    { venue: "binance",  priceUsd: 3502.51, depthUsd: 1_500_000_000, ok: true, ageSeconds: 8 },
    { venue: "uniswap",  priceUsd: 3498.12, depthUsd: 215_000_000, ok: true, ageSeconds: 14 },
  ];
  return base.map((r) =>
    state.tamperedVenue === r.venue && state.tamperedPrice !== null
      ? { ...r, priceUsd: state.tamperedPrice, tampered: true }
      : r,
  );
}

export function deriveTimeline(state: ScenarioState): TimelineEntry[] {
  const block = currentBlock(state.blockOffset);
  const seed: TimelineEntry[] = SEED_TIMELINE.map((entry, i) => ({
    ...entry,
    block: block - (i + 1) * 10,
  }));
  return [...state.events, ...seed].slice(0, 20);
}

export function applyTamper(
  state: ScenarioState,
  venue: VenueReading["venue"],
  priceUsd: number,
): ScenarioState {
  const reference = venue === "coinbase" ? "binance" : "coinbase";
  const ratio = priceUsd / REFERENCE_PRICE;
  const direction =
    ratio >= 2 ? `${ratio.toFixed(1)}×`
    : ratio <= 0.5 ? `${(1 / ratio).toFixed(1)}× below`
    : `${Math.abs((ratio - 1) * 100).toFixed(1)}%`;
  const reason = `${venue} divergent from ${reference} by ${direction}`;

  return {
    ...state,
    tamperedVenue: venue,
    tamperedPrice: priceUsd,
    events: [
      {
        block: currentBlock(state.blockOffset + 1),
        decision: "REFUSED",
        reason,
        reasonHash: REFUSED_HASH,
      },
      ...state.events,
    ].slice(0, 20),
    blockOffset: state.blockOffset + 1,
  };
}

export function applyReset(state: ScenarioState): ScenarioState {
  return {
    ...state,
    tamperedVenue: null,
    tamperedPrice: null,
    events: [
      {
        block: currentBlock(state.blockOffset + 1),
        decision: "PRICED",
        priceUsd: 3502.41,
        maxDeviationBps: 9,
      },
      ...state.events,
    ].slice(0, 20),
    blockOffset: state.blockOffset + 1,
  };
}

export function applyPositionAction(
  state: ScenarioState,
  action: "deposit" | "borrow" | "repay" | "withdraw",
  amount: number,
): ScenarioState {
  const lastPriced = state.events.find((e) => e.decision === "PRICED")?.priceUsd
    ?? SEED_TIMELINE[0].priceUsd!;
  const p = { ...state.position };

  if (action === "deposit") p.collateralWeth += amount;
  else if (action === "withdraw") p.collateralWeth = Math.max(0, p.collateralWeth - amount);
  else if (action === "borrow") p.debtUsdc += amount;
  else if (action === "repay") p.debtUsdc = Math.max(0, p.debtUsdc - amount);

  p.collateralUsd = p.collateralWeth * lastPriced;
  p.debtUsd = p.debtUsdc;
  p.healthFactor = p.debtUsd > 0 ? (p.collateralUsd * 0.85) / p.debtUsd : Infinity;
  p.ltv = p.collateralUsd > 0 ? p.debtUsd / p.collateralUsd : 0;

  return { ...state, position: p };
}
