/**
 * Curated prediction-market questions for the adjudicator demo.
 *
 * Mirrors the input shape of the resolver_oracle.ship agent in
 * github.com/Theseuschain/the-prediction-market: multi-option markets
 * with explicit options, resolution criteria, and a verification
 * source. The agent in this demo uses the same system prompt and
 * output shape as the on-chain SHIP agent — the only difference is
 * that we hand it a pre-curated evidence pack instead of letting it
 * call web_search / fetch_url / get_price live, so the demo tests
 * judgment quality rather than search ability.
 */

export interface EvidenceItem {
  /** Short label for the source. */
  source: string;
  /** ISO date or month label. */
  date: string;
  /** The relevant fact / quote, in plain language. */
  body: string;
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
  /** Hard deadline for resolution. */
  deadline: string;
  /** Plain-English description of how the market should be resolved. */
  resolutionCriteria: string;
  /** Where the agent should look for ground truth (in the on-chain agent
   *  this drives tool selection; here it sets context for the evidence
   *  pack we supply). */
  resolutionSource: string;
  /** Evidence pack the agent reasons over in the demo's sandboxed mode. */
  evidence: EvidenceItem[];
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
    options: ["YES — released", "NO — not released"],
    deadline: "December 31, 2025",
    resolutionCriteria:
      "A model with the official public name 'GPT-5' must be released by December 31, 2025. Internal codenames don't count. Research previews don't count unless the public-facing name is GPT-5. Release means publicly available to API or ChatGPT users, not just announced.",
    resolutionSource: "OpenAI announcements and the OpenAI API model registry",
    evidence: [
      {
        source: "Sam Altman, X (Twitter)",
        date: "Mar 2025",
        body:
          "We're going to release GPT-5 in the coming months. We want to do a lot of stuff before, like release o3 and o4-mini.",
      },
      {
        source: "OpenAI blog post",
        date: "Aug 7, 2025",
        body:
          "Introducing GPT-5: Our smartest, fastest, most useful model yet. GPT-5 is now available to all ChatGPT users.",
      },
      {
        source: "OpenAI API documentation",
        date: "Aug 2025",
        body:
          "Model identifier 'gpt-5' is now available via the Chat Completions API at $1.25 per 1M input tokens.",
      },
    ],
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
      "YES — shipped before WWDC",
      "NO — not shipped before WWDC",
    ],
    deadline: "June 8, 2026 (WWDC 2026 keynote)",
    resolutionCriteria:
      "A successor product, officially named 'Apple Vision Pro 2' or with a clear 2nd-generation designation, must be available for purchase before WWDC 2026 (June 8, 2026). Pre-orders count only if shipping has begun. A spec refresh of the existing Vision Pro doesn't count unless Apple labels it as a new generation.",
    resolutionSource: "Apple Newsroom + supply-chain reporting",
    evidence: [
      {
        source: "Bloomberg / Mark Gurman",
        date: "Jan 2026",
        body:
          "Apple has paused work on a Vision Pro 2 to focus on a cheaper Vision headset. Sources say Vision Pro 2 won't appear before late 2026 at the earliest.",
      },
      {
        source: "Apple supply chain report (Nikkei)",
        date: "Mar 2026",
        body:
          "Apple has cut Vision Pro 1 production for Q2 2026 by approximately 50%. No Q1/Q2 2026 production runs identified for a successor SKU.",
      },
      {
        source: "Apple Newsroom",
        date: "Apr 2026",
        body:
          "WWDC 2026 will run from June 8–12. Apple has not pre-announced any new Vision-line product for the keynote.",
      },
    ],
    actualResolution: {
      winningOption: 1,
      note: "Polymarket resolved NO; no Vision Pro 2 was released before WWDC 2026.",
    },
  },
  {
    id: "iphone-air-flop",
    marketId: 1003,
    category: "Culture",
    question: "Did the iPhone Air launch flop?",
    options: ["YES — flopped", "NO — did not flop"],
    deadline: "December 31, 2025",
    resolutionCriteria:
      "'Flop' is defined as one of: (a) sales miss Apple's internal targets by more than 30% in the first quarter of availability, OR (b) majority-negative public discourse within 60 days of launch. (a) requires a credible source citing Apple's targets vs. actual sales; (b) requires a quantifiable sentiment signal, not anecdotes.",
    resolutionSource: "Apple earnings + sentiment studies + supply-chain reports",
    evidence: [
      {
        source: "Apple Q4 2025 earnings call",
        date: "Oct 30, 2025",
        body:
          "Tim Cook on iPhone Air: 'Demand has been below our published expectations.' No specific number disclosed.",
      },
      {
        source: "Bloomberg",
        date: "Dec 4, 2025",
        body:
          "Apple has cut iPhone Air production by 25% amid soft demand. Sources say first-quarter sales tracked roughly 60% of Apple's internal projection.",
      },
      {
        source: "X/Twitter sentiment study (Pew, n=12,000 posts)",
        date: "Nov 2025",
        body:
          "iPhone Air discourse breakdown: 38% positive, 41% negative, 21% neutral. Negative sentiment skewed toward 'too thin,' 'fragile,' 'overpriced.'",
      },
      {
        source: "Counterpoint Research",
        date: "Jan 2026",
        body:
          "iPhone Air shipped 4.2M units in its first quarter. Counterpoint had projected 5.5M based on Apple's pre-launch supply orders.",
      },
    ],
    actualResolution: {
      winningOption: 0,
      note:
        "Polymarket resolved YES (flopped) under criterion (a): the ~40% miss vs. Apple's internal projection cleared the 30% threshold. Sentiment alone (criterion b) wouldn't have settled it — 41% negative isn't a majority — but criterion (a) is dispositive.",
    },
  },
  {
    id: "btc-200k-eoy-2025",
    marketId: 1004,
    category: "Crypto",
    question: "Will Bitcoin reach $200,000 by end of 2025?",
    options: ["YES — hit $200K", "NO — did not hit $200K"],
    deadline: "December 31, 2025 23:59 UTC",
    resolutionCriteria:
      "BTC/USD must trade at or above $200,000 on any major exchange (Coinbase, Binance, Kraken, Bitstamp) at any point before the deadline. Stablecoin pairs (USDT, USDC) count if priced in USD. Brief flash spikes count provided they're not subsequently retracted as data errors.",
    resolutionSource: "Major-exchange historical data",
    evidence: [
      {
        source: "Coinbase historical data",
        date: "Nov 2025",
        body:
          "BTC peaked at $113,247 on November 14, 2025. No subsequent move higher.",
      },
      {
        source: "Binance historical data",
        date: "Dec 2025",
        body:
          "BTC closing prices in December 2025 ranged $94,800–$108,500. No prints above $115,000.",
      },
      {
        source: "Kraken end-of-year snapshot",
        date: "Dec 31, 2025",
        body: "BTC/USD final 2025 close: $97,420.",
      },
    ],
    actualResolution: {
      winningOption: 1,
      note: "Polymarket resolved NO. BTC did not reach $200,000 in 2025.",
    },
  },
];

export function findMarket(id: string): PredictionMarket | undefined {
  return MARKETS.find((m) => m.id === id);
}
