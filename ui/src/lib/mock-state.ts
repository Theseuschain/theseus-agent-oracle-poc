/**
 * Cached mock state used until the chain is actually deployed and the
 * NEXT_PUBLIC_* deployment addresses are populated. The API routes fall back
 * to this when on-chain reads aren't possible (so the UI is screenshottable
 * and demo-able from day one).
 */

import { FeedSnapshot, VenueReading, TimelineEntry, UserPosition } from "./types";

let nowSec = () => Math.floor(Date.now() / 1000);

const startBlock = 4_829_000;
const blockTime = 6;

function currentBlock(): number {
  return startBlock + Math.floor((Date.now() / 1000 - 1714000000) / blockTime) % 1_000_000;
}

interface MockState {
  refused: boolean;
  refusedReason?: string;
  tampered: Set<VenueReading["venue"]>;
  tamperedPrice?: number;
  tamperedVenue?: VenueReading["venue"];
  timeline: TimelineEntry[];
  position: UserPosition;
}

// Persist on globalThis so route handlers (which Next.js dev-mode loads
// in separate module instances) share the same state object.
declare global {
  // eslint-disable-next-line no-var
  var __theseusOracleMockState: MockState | undefined;
}

const state: MockState = (globalThis.__theseusOracleMockState ??= {
  refused: false,
  tampered: new Set(),
  timeline: seedTimeline(),
  position: {
    collateralWeth: 0,
    collateralUsd: 0,
    debtUsdc: 0,
    debtUsd: 0,
    healthFactor: Infinity,
    ltv: 0,
  },
});

function seedTimeline(): TimelineEntry[] {
  const t: TimelineEntry[] = [];
  const block = currentBlock();
  const prices = [3502.41, 3499.07, 3495.22, 3498.10, 3501.94];
  const devs = [12, 8, 15, 6, 11];
  for (let i = 0; i < prices.length; i++) {
    t.push({
      block: block - (i + 1) * 10,
      decision: "PRICED",
      priceUsd: prices[i],
      maxDeviationBps: devs[i],
    });
  }
  return t;
}

export function getMockFeed(): FeedSnapshot {
  const block = currentBlock();
  const lastEntry = state.timeline[0];
  if (state.refused) {
    return {
      decision: "REFUSED",
      priceUsd: 0,
      updatedAt: nowSec() - 5,
      block,
      reasonHash: "0x" + (state.tamperedVenue === "uniswap" ? "8a3f7b2c4d5e6f819203a4b5c6d7e8f90123456789abcdef0123456789abcdef" : "abc1234567890def1234567890abcdef1234567890abcdef1234567890abcdef"),
      ageSeconds: 5,
    };
  }
  return {
    decision: "PRICED",
    priceUsd: lastEntry?.priceUsd ?? 3502.41,
    updatedAt: nowSec() - 12,
    block,
    reasonHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    ageSeconds: 12,
  };
}

export function getMockVenues(): VenueReading[] {
  const out: VenueReading[] = [
    {
      venue: "coinbase",
      priceUsd: 3502.40,
      depthUsd: 48_200_000,
      ok: true,
      ageSeconds: 4,
    },
    {
      venue: "binance",
      priceUsd: 3502.51,
      depthUsd: 1_500_000_000,
      ok: true,
      ageSeconds: 8,
    },
    {
      venue: "uniswap",
      priceUsd: 3498.12,
      depthUsd: 215_000_000,
      ok: true,
      ageSeconds: 14,
    },
  ];
  for (const r of out) {
    if (state.tampered.has(r.venue)) {
      r.tampered = true;
      if (state.tamperedPrice !== undefined) r.priceUsd = state.tamperedPrice;
      if (state.tamperedVenue !== r.venue && state.tamperedPrice !== undefined) {
        // only the requested venue gets the override
      }
    }
  }
  return out;
}

export function getMockTimeline(): TimelineEntry[] {
  return state.timeline.slice(0, 8);
}

export function getMockPosition(): UserPosition {
  return state.position;
}

export function mockTamper(venue: VenueReading["venue"], priceUsd: number): void {
  state.tampered.add(venue);
  state.tamperedPrice = priceUsd;
  state.tamperedVenue = venue;
  state.refused = true;

  // Compare against a venue that *isn't* the tampered one. The reconciliation
  // policy fires when the tampered venue diverges from the others, so the
  // message should name the venue we're comparing against.
  const reference = venue === "coinbase" ? "binance" : "coinbase";
  const referencePrice = 3502.4;
  const ratio = priceUsd / referencePrice;
  const direction =
    ratio >= 2 ? `${ratio.toFixed(1)}×`
    : ratio <= 0.5 ? `${(1 / ratio).toFixed(1)}× below`
    : `${Math.abs((ratio - 1) * 100).toFixed(1)}%`;
  state.refusedReason = `${venue} divergent from ${reference} by ${direction}`;
  state.timeline.unshift({
    block: currentBlock(),
    decision: "REFUSED",
    reason: state.refusedReason,
    reasonHash: "0x8a3f7b2c4d5e6f819203a4b5c6d7e8f90123456789abcdef0123456789abcdef",
  });
  state.timeline = state.timeline.slice(0, 20);
}

export function mockReset(): void {
  state.tampered.clear();
  state.tamperedPrice = undefined;
  state.tamperedVenue = undefined;
  state.refused = false;
  state.refusedReason = undefined;
  state.timeline.unshift({
    block: currentBlock(),
    decision: "PRICED",
    priceUsd: 3502.41,
    maxDeviationBps: 9,
  });
  state.timeline = state.timeline.slice(0, 20);
}

export function mockUpdatePosition(action: "deposit" | "borrow" | "repay" | "withdraw", amount: number): void {
  const ethPrice = state.refused ? 3502 : (state.timeline[0]?.priceUsd ?? 3502);
  const p = state.position;
  if (action === "deposit") {
    p.collateralWeth += amount;
  } else if (action === "withdraw") {
    p.collateralWeth = Math.max(0, p.collateralWeth - amount);
  } else if (action === "borrow") {
    p.debtUsdc += amount;
  } else if (action === "repay") {
    p.debtUsdc = Math.max(0, p.debtUsdc - amount);
  }
  p.collateralUsd = p.collateralWeth * ethPrice;
  p.debtUsd = p.debtUsdc;
  p.healthFactor = p.debtUsd > 0 ? (p.collateralUsd * 0.85) / p.debtUsd : Infinity;
  p.ltv = p.collateralUsd > 0 ? p.debtUsd / p.collateralUsd : 0;
}
