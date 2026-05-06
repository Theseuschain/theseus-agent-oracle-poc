//! Binance Ticker Tool
//!
//! Documents the `binance_ticker` tool used by `agents/price_oracle.ship`.
//! The actual implementation lives in the Theseus tool-executor crate.
//!
//! ## Tool Signature
//!
//! ```ship
//! tool binance_ticker(symbol: string) -> VenueReading;
//! ```
//! Returns the same `VenueReading` struct as `coinbase_orderbook`.
//!
//! ## Behavior
//!
//! 1. Fetches `GET https://api.binance.com/api/v3/ticker/24hr?symbol={symbol}`.
//!    Public endpoint, no auth.
//! 2. Returns:
//!    - `price_usd` = `lastPrice` from the response.
//!    - `depth_usd` = `quoteVolume` (24h $ volume) — used as a *proxy* for depth.
//!      This is a weaker signal than Coinbase's order-book depth, but it is what
//!      Binance's free API provides without an authenticated WebSocket session.
//!    - `timestamp` = `closeTime` from the response.
//!
//! ## Caveat on depth
//!
//! 24h volume is a worse depth proxy than an order book. To upgrade, swap the
//! REST call for `/api/v3/depth?symbol={symbol}&limit=500` and run the same
//! 50bps walk used in `coinbase_orderbook`. Left as a v0 simplification because
//! it doesn't change the structural demonstration: the divergence detection in
//! the reconciliation policy works as long as Binance and Coinbase normally
//! agree to within 50bps, which they do.
//!
//! ## Failure modes
//!
//! - 5xx / network → `ok = false, error = "binance: <status>"`.
//! - `lastPrice == "0.00000000"` (rare, on suspended pairs) → `ok = false`.
//! - Region-blocked (Binance.com sometimes returns 451 from US IPs) →
//!   `ok = false, error = "binance: 451"`. Document operationally — the
//!   tool-executor host is expected to run in a region with API access.
//!
//! ## Configuration (tool-executor/config.yaml)
//!
//! ```yaml
//! tools:
//!   binance_ticker:
//!     base_url: "https://api.binance.com"
//!     timeout_ms: 5000
//!     rate_limit_ms: 1000
//! ```
//!
//! ## Reference symbols
//!
//! Binance uses concatenated pairs: `ETHUSDT`, `BTCUSDT`, `SOLUSDT`. Pass through
//! unchanged.
