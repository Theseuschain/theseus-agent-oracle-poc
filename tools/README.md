# Tools

This directory **documents** the tools the price oracle agent depends on. Like the prediction-market repo, the actual Rust implementations live in the Theseus chain's `tool-executor` crate — these files are the spec, not the build target.

For the PoC to run, the tool-executor needs four entries:

| Tool | Status | Notes |
|------|--------|-------|
| `coinbase_orderbook` | New | Reads Coinbase Advanced API order book; returns mid + $ depth within 50bps. |
| `binance_ticker` | New | Reads Binance public ticker API; returns last price + 24h volume. |
| `uniswap_twap` | New | Reads a Uniswap V3 pool's `observe()` over a window; returns TWAP + pool TVL. |
| `evm_call` | **Bridge dependency** | Invokes a function on a `pallet-evm` contract. See [`evm_call.rs`](./evm_call.rs). |

The bridge dependency (`evm_call`) is the one item in this PoC that requires runtime work outside what's already in `the-prediction-market`. The SHIP↔EVM precompile pattern is well-trod in Substrate (Moonbeam, Astar) — this is just calling that out explicitly so it doesn't get lost.

## Tool registration shape

Each tool is registered in `tool-executor/src/tools.rs` (Theseus runtime) by:

1. Defining a struct that implements the executor's `Tool` trait.
2. Declaring the input/output types matching the SHIP signature.
3. Adding the struct to the executor's tool registry under the tool name.
4. Adding any config (rate limits, endpoints) to `tool-executor/config.yaml`.

The pattern is exactly the one [`get_price`](https://github.com/Theseuschain/the-prediction-market/blob/master/tools/get_price.rs) follows.

## Why custom tools instead of `get_price`

`get_price` wraps CoinGecko's spot API — a single source, no depth information, polled. The whole point of this PoC is that an agent doing depth-aware multi-venue reads can refuse manipulation that a single-source feed can't see. CoinGecko spot is exactly the kind of feed the contract-and-oracle architecture relies on. We need to read venues directly.
