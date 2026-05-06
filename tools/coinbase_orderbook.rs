//! Coinbase Order Book Tool
//!
//! Documents the `coinbase_orderbook` tool used by `agents/price_oracle.ship`.
//! The actual implementation lives in the Theseus tool-executor crate.
//!
//! ## Tool Signature
//!
//! ```ship
//! tool coinbase_orderbook(symbol: string) -> VenueReading;
//!
//! struct VenueReading {
//!     venue: string,           // "coinbase"
//!     price_usd: number,       // depth-weighted mid
//!     depth_usd: number,       // $ liquidity within 50bps of mid (both sides)
//!     timestamp: number,       // unix seconds
//!     ok: bool,
//!     error?: string
//! }
//! ```
//!
//! ## Behavior
//!
//! 1. Fetches `GET https://api.exchange.coinbase.com/products/{symbol}/book?level=2`.
//!    `level=2` returns aggregated bids and asks, sufficient for a depth calculation
//!    without authentication.
//! 2. Computes mid = (best_bid + best_ask) / 2.
//! 3. Walks the book on both sides until cumulative depth covers 50bps of mid.
//! 4. Returns:
//!    - `price_usd` = depth-weighted mid (mid for v0; full VWAP later)
//!    - `depth_usd` = sum of $ size of all levels within 50bps
//!
//! ## Why depth matters
//!
//! The Mango exploit moved a price by trading against a thin book. A reading like
//! "mid = $X" is only useful if you can also say "and there's $Y of liquidity within
//! 50bps." A reading with $5k of depth is not the same signal as one with $50M of
//! depth, and the agent's reconciliation policy weights venues accordingly.
//!
//! ## Failure modes
//!
//! - Coinbase 5xx / network error → `ok = false, error = "coinbase: <status>"`.
//! - Empty book → `ok = false, error = "coinbase: empty_book"`.
//! - Book skew >5% (best bid << best ask) → `ok = false, error = "coinbase: book_skew"`.
//!
//! The agent treats `ok = false` as an unavailable venue, not as a price.
//!
//! ## Configuration (tool-executor/config.yaml)
//!
//! ```yaml
//! tools:
//!   coinbase_orderbook:
//!     base_url: "https://api.exchange.coinbase.com"
//!     timeout_ms: 5000
//!     rate_limit_ms: 1000
//!     depth_bps: 50
//! ```
//!
//! ## Reference symbols
//!
//! Pass through unchanged: `ETH-USD`, `BTC-USD`, `SOL-USD`, etc.
