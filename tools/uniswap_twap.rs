//! Uniswap V3 TWAP Tool
//!
//! Documents the `uniswap_twap` tool used by `agents/price_oracle.ship`.
//! The actual implementation lives in the Theseus tool-executor crate.
//!
//! ## Tool Signature
//!
//! ```ship
//! tool uniswap_twap(pool_address: address, window_seconds: number) -> VenueReading;
//! ```
//!
//! ## Behavior
//!
//! Reads a Uniswap V3 pool's `observe()` function over `window_seconds`. This
//! is the *Ethereum mainnet* Uniswap V3 pool, accessed via an EVM-RPC tool
//! provider (the chain-extension boundary the SHIP agent crosses to read
//! external EVM state — same shape as `fetch_url`, with an `eth_call` body).
//!
//! For the WETH/USDC 0.05% pool on Ethereum mainnet:
//!   pool = 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640
//!
//! 1. `observe([0, window_seconds])` → cumulative tick observations.
//! 2. Average tick over the window → sqrtPriceX96 → human price.
//! 3. `slot0()` for instantaneous comparison (anti-manipulation tripwire).
//! 4. `liquidity()` and pool token balances → $ TVL approximation.
//!
//! ## Returns
//!
//! - `price_usd` = TWAP-derived ETH/USDC price.
//! - `depth_usd` = pool's USDC reserve + pool's WETH reserve × twap (rough TVL
//!   that survives a flash loan, since draining the pool clears reserves).
//! - `timestamp` = block timestamp at the observation.
//!
//! ## Why TWAP not spot
//!
//! A spot AMM read is the easiest thing to manipulate — one big trade in the
//! same block can move it 10×. Aave V3 and Compound V3 both default to TWAP for
//! AMM-derived prices for exactly this reason. A 30-minute window means an
//! attacker would need to maintain the manipulated price for 30 minutes against
//! arbitragers, which is expensive and usually unprofitable.
//!
//! Note: even with TWAP, an attacker can manipulate the *agent's* reading if
//! they can manipulate the pool. The agent's defense against this is **the
//! reconciliation policy** — Uniswap's TWAP is one of three readings, and
//! divergence from Coinbase + Binance triggers refusal. TWAP raises the
//! attacker's cost; reconciliation eliminates the attack class.
//!
//! ## Failure modes
//!
//! - RPC error or pool doesn't exist → `ok = false, error = "uniswap: <reason>"`.
//! - Pool's observation cardinality < window → `ok = false, error = "uniswap: insufficient_observations"`.
//!   (Pools auto-expand cardinality on use, but new pools can hit this.)
//! - TVL below configured floor (e.g., < $100k) → `ok = false, error = "uniswap: thin_pool"`.
//!
//! ## Configuration
//!
//! ```yaml
//! tools:
//!   uniswap_twap:
//!     # The agent reads Ethereum mainnet pools through an EVM-RPC provider.
//!     # In production the runtime should configure multiple providers and
//!     # cross-check, the same way the agent itself cross-checks venues.
//!     rpc_url: "${MAINNET_RPC_URL}"
//!     timeout_ms: 5000
//!     min_tvl_usd: 100000
//!     max_window_seconds: 3600
//! ```
