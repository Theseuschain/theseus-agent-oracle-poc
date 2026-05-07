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

export interface AgentInspect {
  /** Snapshot of the venues exactly as the agent saw them. */
  venues: VenueReading[];
  referencePrice: number;
  scenarioHint?: string;
  /** What we sent to the model, full text. */
  prompt?: { system: string; user: string };
  /** Raw content the model returned (before JSON parsing). */
  rawResponse?: string;
  model?: string;
  latencyMs?: number;
}

export interface TimelineEntry {
  block: number;
  decision: Decision;
  /** True while the LLM call is still in flight for this entry. The
   *  decision/price/reasoning fields are placeholders until the LLM
   *  responds and replaces them. */
  pending?: boolean;
  priceUsd?: number;
  maxDeviationBps?: number;
  reason?: string;
  reasonHash?: string;
  /** Natural-language chain-of-thought from the agent. Multi-line allowed. */
  reasoning?: string;
  /** Everything the agent saw + the prompt and raw response. */
  inspect?: AgentInspect;
}

export interface TamperRequest {
  venue: VenueReading["venue"];
  priceUsd: number;
  runs: number;
}
