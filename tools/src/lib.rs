//! Tool implementations for the price oracle agent.
//!
//! Each tool is a plain async function. Integration into Theseus's tool-executor
//! is the registrar's job — wrap whichever function in a `Tool` trait impl and
//! register under the right name.
//!
//! All tools return `Result<VenueReading>` with `ok = true` on success and
//! `ok = false` (with an `error` message) on any handled failure. Network
//! errors propagate via `anyhow::Error` — the caller is expected to convert
//! those into `VenueReading { ok: false, error: Some(_), .. }` if it wants
//! the agent to see them as a failed venue rather than a crash.

pub mod types;
pub use types::VenueReading;

pub mod coinbase_orderbook;
pub mod binance_ticker;
pub mod uniswap_twap;

// evm_call is documented but not implementable here — it requires
// pallet-evm dispatch from inside the runtime. See evm_call.rs.
pub mod evm_call;

pub use coinbase_orderbook::coinbase_orderbook;
pub use binance_ticker::binance_ticker;
pub use uniswap_twap::uniswap_twap;
