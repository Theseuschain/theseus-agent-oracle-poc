/**
 * Curated prediction-market questions for the prediction market
 * adjudicator demo.
 *
 * Mirrors the input shape of the resolver_oracle.ship agent in
 * github.com/Theseuschain/the-prediction-market: multi-option markets
 * with explicit options, resolution criteria, and a verification
 * source. The agent gathers its own evidence at runtime by calling
 * Anthropic's web_search tool, the same way the on-chain SHIP agent
 * calls web_search / fetch_url / get_price.
 */

export interface Citation {
  url: string;
  title: string;
}

export interface PredictionMarket {
  id: string;
  /** Numeric market_id matching the resolver_oracle's expected input. */
  marketId: number;
  /** Optional Polymarket-style category, just for the UI. */
  category: string;
  /** The market question. */
  question: string;
  /** The options the agent picks among (0-indexed). */
  options: string[];
  /** Hard deadline for resolution (human-readable, shown in UI). */
  deadline: string;
  /** Parseable ISO form of the deadline. Used for programmatic
   *  "is the deadline in the future?" checks. End-of-day in UTC. */
  deadlineISO: string;
  /** Plain-English description of how the market should be resolved. */
  resolutionCriteria: string;
  /** Where the agent should look for ground truth (drives search
   *  strategy: which sources to prioritize). */
  resolutionSource: string;
  /** What the actual market resolved to (if known). The
   *  `winningOption` is the 0-based index into `options`. */
  actualResolution?: {
    winningOption: number;
    note: string;
  };
}

export const MARKETS: PredictionMarket[] = [
  {
    id: "openai-gpt5-2025",
    marketId: 1001,
    category: "Tech",
    question: "Will OpenAI release a model named GPT-5 by end of 2025?",
    options: ["YES (released)", "NO (not released)"],
    deadline: "December 31, 2025",
    deadlineISO: "2025-12-31",
    resolutionCriteria:
      "A model with the official public name 'GPT-5' must be released by December 31, 2025. Internal codenames don't count. Research previews don't count unless the public-facing name is GPT-5. Release means publicly available to API or ChatGPT users, not just announced.",
    resolutionSource: "OpenAI announcements and the OpenAI API model registry",
    actualResolution: {
      winningOption: 0,
      note: "Polymarket resolved YES on Aug 7, 2025.",
    },
  },
  {
    id: "vision-pro-2-pre-wwdc-2026",
    marketId: 1002,
    category: "Tech",
    question: "Will Apple ship the Vision Pro 2 before WWDC 2026?",
    options: [
      "YES (shipped before WWDC)",
      "NO (not shipped before WWDC)",
    ],
    deadline: "June 8, 2026 (WWDC 2026 keynote)",
    deadlineISO: "2026-06-08",
    resolutionCriteria:
      "A successor product, officially named 'Apple Vision Pro 2' or with a clear 2nd-generation designation, must be available for purchase before WWDC 2026 (June 8, 2026). Pre-orders count only if shipping has begun. A spec refresh of the existing Vision Pro doesn't count unless Apple labels it as a new generation.",
    resolutionSource: "Apple Newsroom + supply-chain reporting",
  },
  {
    id: "iphone-air-flop",
    marketId: 1003,
    category: "Culture",
    question: "Will the iPhone Air launch flop?",
    options: ["YES (flopped)", "NO (did not flop)"],
    deadline: "December 31, 2025",
    deadlineISO: "2025-12-31",
    resolutionCriteria:
      "'Flop' is defined as one of: (a) sales miss Apple's internal targets by more than 30% in the first quarter of availability, OR (b) majority-negative public discourse within 60 days of launch. (a) requires a credible source citing Apple's targets vs. actual sales; (b) requires a quantifiable sentiment signal, not anecdotes.",
    resolutionSource: "Apple earnings, sentiment studies, supply-chain reports",
    actualResolution: {
      winningOption: 0,
      note:
        "Polymarket resolved YES (flopped) under criterion (a): the ~40% miss vs. Apple's internal projection cleared the 30% threshold. Sentiment alone (criterion b) wouldn't have settled it (41% negative isn't a majority), but criterion (a) is dispositive.",
    },
  },
  {
    id: "btc-200k-eoy-2025",
    marketId: 1004,
    category: "Crypto",
    question: "Will Bitcoin reach $200,000 by end of 2025?",
    options: ["YES (hit $200K)", "NO (did not hit $200K)"],
    deadline: "December 31, 2025 23:59 UTC",
    deadlineISO: "2025-12-31",
    resolutionCriteria:
      "BTC/USD must trade at or above $200,000 on any major exchange (Coinbase, Binance, Kraken, Bitstamp) at any point before the deadline. Stablecoin pairs (USDT, USDC) count if priced in USD. Brief flash spikes count provided they're not subsequently retracted as data errors.",
    resolutionSource: "Major-exchange historical data",
    actualResolution: {
      winningOption: 1,
      note: "Polymarket resolved NO. BTC did not reach $200,000 in 2025.",
    },
  },
];

export function findMarket(id: string): PredictionMarket | undefined {
  return MARKETS.find((m) => m.id === id);
}
