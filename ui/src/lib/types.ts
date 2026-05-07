export type Decision = "PRICED" | "REFUSED" | "UNINITIALIZED";

export interface FeedSnapshot {
  decision: Decision;
  priceUsd: number;
  updatedAt: number; // unix seconds
  block: number;
  reasonHash: string; // 0x...
  ageSeconds: number;
}

export interface VenueReading {
  venue: "coinbase" | "binance" | "uniswap";
  priceUsd: number;
  depthUsd: number;
  ok: boolean;
  ageSeconds: number;
  error?: string;
  tampered?: boolean; // true when this venue is currently overridden
}

export interface UserPosition {
  collateralWeth: number;
  collateralUsd: number;
  debtUsdc: number;
  debtUsd: number;
  healthFactor: number; // 1.0 = at liquidation
  ltv: number;
}

export interface TimelineEntry {
  block: number;
  decision: Decision;
  priceUsd?: number;
  maxDeviationBps?: number;
  reason?: string;
  reasonHash?: string;
  /** Natural-language chain-of-thought from the agent. Multi-line allowed. */
  reasoning?: string;
}

export interface TamperRequest {
  venue: VenueReading["venue"];
  priceUsd: number;
  runs: number;
}
