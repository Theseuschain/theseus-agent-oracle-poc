# Status

What's wired vs. what still needs work to run end-to-end.

## Wired

| Component | State |
|-----------|-------|
| `contracts/src/AgentPriceFeed.sol` | Complete. Chainlink V2 + V3 interfaces. Reverts on `REFUSED`. |
| `contracts/src/mocks/{MockWETH9,MockERC20,FixedPriceFeed}.sol` | Complete. Local-demo assets. |
| `contracts/script/DeployFeed.s.sol` | Complete. |
| `contracts/script/DeployAave.s.sol` | Complete. Deploys registry, addresses provider, ACL, pool, configurator, oracle, token impls. |
| `contracts/script/ConfigureMarket.s.sol` | Complete. Wires WETH/USDC reserves; points oracle at `AgentPriceFeed`. |
| `contracts/script/DeployMocks.s.sol` | Complete. WETH9, USDC mock, fixed $1 USDC feed. |
| `contracts/foundry.toml` + `scripts/vendor_aave.sh` | Complete. Aave V3 pinned commit. |
| `agents/price_oracle.ship` | Complete. Schedule = 10 blocks. Reads three venues, reconciles, calls `evm_call`. |
| `agents/{PRICE_ORACLE_SOUL,RECONCILIATION_POLICY}.md` | Complete. |
| `tools/` Rust crate | **Buildable.** Real implementations of `coinbase_orderbook`, `binance_ticker`, `uniswap_twap`. `evm_call.rs` documents the runtime-side impl (can't be built standalone — needs `pallet-revive` dispatch). |
| `pallets/tool-override/` | **Buildable** as a standalone FRAME pallet. Storage, four extrinsics (`override_tool`, `clear_override`, `clear_overrides`, `tick`), `Pallet::resolve()` for the tool-executor to call. |
| `cli/` | **Compiles.** Aave-side commands use real alloy bindings. Substrate-side uses subxt's dynamic API targeting `pallet-tool-override`. |
| `ui/` | **Buildable Next.js app.** Four panels (live feed, three venue cards with tamper, position, decision timeline). Two modes: mock (no chain required) and live (reads `AgentPriceFeed`, submits to `pallet-tool-override`). Mock mode is fully working for screenshots / decks today. |
| `scripts/{vendor_aave,setup_demo,demo}.sh` | Complete. |

## Runtime integration steps required

These are the only items that have to happen *inside Theseus's runtime crate*
(which is not in this repo). Each is a small, isolated change:

1. **Register the tool-override pallet.** Add to `Cargo.toml`, configure
   `Config`, add to `construct_runtime!`. See [`pallets/tool-override/README.md`](pallets/tool-override/README.md).

2. **Register the venue tools with the tool-executor.** The tool-executor
   needs to wrap each function in `tools/src/` as a `Tool` trait impl and add
   it to the registry under the right name (`coinbase_orderbook`,
   `binance_ticker`, `uniswap_twap`).

3. **Implement the `evm_call` precompile/tool.** A SHIP→PolkaVM dispatch through
   `pallet_revive::Pallet::call` (Theseus runs PolkaVM, not Frontier `pallet-evm`).
   Sketch in [`tools/src/evm_call.rs`](tools/src/evm_call.rs). The canonical
   reference for the EVM toolchain (resolc, foundry-polkadot, dual profile
   pattern) is [`Theseuschain/theseus-layerzero-evm`](https://github.com/Theseuschain/theseus-layerzero-evm).
   This is the SHIP↔EVM bridge that's the only meaningful runtime addition
   for this PoC.

4. **Hook the tool-executor's tool dispatch loop:** before invoking the real
   tool, call `pallet_tool_override::Pallet::<Runtime>::resolve(agent, tool)`
   and return the override bytes if any. At the start of each scheduled
   agent run, dispatch `tool_override::tick(agent)`.

## What's intentionally stubbed

- **Next-run block in `op status`.** The agent's scheduler-driven next run
  block lives in whatever pallet handles SHIP scheduling. We surface zeros
  for that field; the user infers liveness from "did the feed update recently?"
  in the same status line.

- **TensorCommit emission for `reportRefusal`.** The contract anchors
  `keccak256(reasoning)`; the matching reasoning blob commit happens through
  whatever TensorCommit hook the SHIP runtime exposes. Out of scope for v0;
  the on-chain hash is enough to demonstrate the architecture.

- **Production-grade Aave reserve params.** `ConfigureMarket.s.sol` uses
  placeholder LTV/liquidation-threshold/liquidation-bonus. The demo doesn't
  depend on liquidation mechanics — only on the price-touching paths
  reverting when the agent refuses.

## Verifying the tools crate

```bash
cd tools/
cargo build
cargo test
```

The unit tests cover the parsing logic for both Coinbase book levels and
Binance ticker responses. Live integration is exercised by the demo script.

## Reproduction (after the four runtime integration steps land)

```bash
git clone https://github.com/Theseuschain/agent-oracle-poc
cd agent-oracle-poc
./scripts/setup_demo.sh
./scripts/demo.sh
```

Expected scenario: the agent prices ETH at the live cross-venue mid; `op tamper
uniswap --price 100000` swaps in a manipulated Uniswap reading; the next
agent run hits the 50bps divergence threshold and calls `reportRefusal`; Aave
borrows and liquidations revert; `op reset` clears the override; the agent
re-prices on its next cycle.
