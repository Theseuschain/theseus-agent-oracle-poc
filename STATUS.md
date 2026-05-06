# Status

What's wired vs. what still needs work to run end-to-end. Updated with each commit.

## Wired

| Component | State |
|-----------|-------|
| `contracts/src/AgentPriceFeed.sol` | Complete. Chainlink V2 (`latestAnswer`) and V3 (`latestRoundData`) interfaces. Reverts on `REFUSED`. |
| `contracts/script/DeployFeed.s.sol` | Complete. Reads agent EVM address from env. |
| `contracts/script/DeployAave.s.sol` | Complete. Deploys registry, addresses provider, ACL, pool impl, configurator, oracle, token impls. |
| `contracts/script/ConfigureMarket.s.sol` | Complete. Wires WETH/USDC reserves; points oracle at `AgentPriceFeed`. |
| `agents/price_oracle.ship` | Complete. Schedule = 10 blocks. Reads three venues, reconciles, calls `evm_call` with `reportPrice` or `reportRefusal`. |
| `agents/PRICE_ORACLE_SOUL.md` | Complete. |
| `agents/RECONCILIATION_POLICY.md` | Complete. 50bps divergence threshold; depth-weighted median. |
| `tools/*.rs` | Documentation only. Each describes the tool-executor implementation needed. |
| `cli/` | Compiles. Aave-side commands use real alloy bindings; Substrate-side stubs print intent. |
| `scripts/vendor_aave.sh` | Complete. Pinned to a known Aave V3 commit. |
| `scripts/setup_demo.sh` | Complete shape. Depends on `theseus-cli`, `theseus-node`, and a `DeployMocks.s.sol` (TODO). |
| `scripts/demo.sh` | Complete. Runs the full happy-path → tamper → refusal scenario. |

## Not yet wired

These are the pieces blocking end-to-end execution.

### 1. `tool-executor` runtime additions

The four tools the agent declares are not implemented yet in Theseus's `tool-executor` crate:

- `coinbase_orderbook(symbol)` — needs HTTP fetch + book-walking logic.
- `binance_ticker(symbol)` — needs HTTP fetch.
- `uniswap_twap(pool, window)` — needs an EVM-RPC client to read mainnet pools (separate from the Theseus EVM).
- `evm_call(target, data, value)` — the SHIP↔EVM precompile, the one runtime dependency this PoC explicitly adds. See [`tools/evm_call.rs`](tools/evm_call.rs).

Each tool stub in [`tools/`](tools/) documents the expected behavior, config, and signature. They're meant to drop into `tool-executor/src/tools.rs` next to the existing `get_price`.

### 2. `DeployMocks.s.sol`

`scripts/setup_demo.sh` references `contracts/script/DeployMocks.s.sol` which deploys local-only ERC-20 mocks for WETH and USDC plus a fixed-`$1` USDC feed. Not written yet — straightforward to add (one ERC-20 + one constant feed).

### 3. CLI Substrate-side stubs

[`cli/src/agent.rs`](cli/src/agent.rs) currently prints what the tamper / reset / status calls *would* do. Wiring the real subxt calls requires:

- A demo `ToolOverridePallet` in the Theseus runtime (also feature-flagged off).
- subxt-generated metadata for that pallet.

The tamper pallet is demo-only. In production, agents resolve tools through the standard tool-executor and there's no override path.

### 4. Aave reserve initialization parameters

`ConfigureMarket.s.sol` uses placeholder LTV (8000), liquidation threshold (8500), and liquidation bonus (10500) for WETH. These are reasonable defaults, but for a demo that's about price refusal — not liquidation mechanics — they're not load-bearing.

## What's intentionally stubbed

- **TensorCommit emission**. The `reportRefusal(bytes32 reasonHash)` call anchors a hash. The matching reasoning blob would normally be committed via TensorCommit at the same block. Wiring that requires SHIP runtime support that's not in scope for v0 — the on-chain hash is enough to demonstrate the architecture.

- **Production interest rate strategy**. `ConfigureMarket` deploys one rate strategy with placeholder parameters. Nothing in the demo depends on the rate curve.

## Reproduction (once the gaps are closed)

```bash
git clone https://github.com/Theseuschain/agent-oracle-poc
cd agent-oracle-poc
./scripts/setup_demo.sh   # vendors Aave, deploys, registers agent
./scripts/demo.sh         # runs the scenario
```

Expected output: see scenario steps in [`scripts/demo.sh`](scripts/demo.sh).
