<div align="center">

# Theseus Agent Oracle

**Aave V3, unmodified. The oracle is a Theseus agent.**

[![Built on Theseus](https://img.shields.io/badge/Built%20on-Theseus-blue?style=flat-square)](https://www.theseuschain.com)
[![SHIP](https://img.shields.io/badge/Language-SHIP-orange?style=flat-square)](https://www.theseuschain.com/docs/ship)
[![Aave V3](https://img.shields.io/badge/Forks-Aave%20V3-purple?style=flat-square)](https://github.com/aave/aave-v3-core)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

## What this is

A working demonstration that on-chain agents can replace the contract-and-oracle pattern in DeFi.

We deploy Aave V3 to the Theseus EVM, change nothing about the protocol, and point its price oracle at a SHIP agent that reads multiple venues directly. When venues disagree, the agent **refuses to price**, and Aave halts every operation that would touch that asset's value. Liquidations stop, new borrows revert, withdrawals continue.

The Cream Finance, Mango, and Terra failures all share the same shape: a contract that obediently executed against a number the rest of the market had already abandoned. This repo demonstrates the alternative — an executor that can decline.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   Theseus EVM (pallet-revive / PolkaVM) Theseus AIVM (SHIP)          │
│  ┌─────────────────────────┐           ┌──────────────────────────┐  │
│  │                         │           │                          │  │
│  │   Aave V3 Pool          │           │  price_oracle.ship       │  │
│  │   (unmodified fork)     │           │                          │  │
│  │                         │           │  schedule = 10           │  │
│  │      │                  │           │  (~60s @ 6s blocks)      │  │
│  │      │ getAssetPrice()  │           │                          │  │
│  │      ▼                  │           │  ┌──────────────────┐    │  │
│  │  ┌───────────────────┐  │           │  │ read 3 venues:   │    │  │
│  │  │ AgentPriceFeed    │  │◀──────────┤  │ - Coinbase L2    │    │  │
│  │  │ (Chainlink-shaped)│  │ evm_call  │  │ - Binance ticker │    │  │
│  │  │  latestRoundData()│  │           │  │ - Uniswap TWAP   │    │  │
│  │  │  - price          │  │           │  └──────────────────┘    │  │
│  │  │  - decision flag  │  │           │           │              │  │
│  │  └───────────────────┘  │           │           ▼              │  │
│  │                         │           │  ┌──────────────────┐    │  │
│  │  reverts on             │           │  │ reconcile        │    │  │
│  │  decision == REFUSED    │           │  │ (depth-weighted) │    │  │
│  │                         │           │  └──────────────────┘    │  │
│  └─────────────────────────┘           │           │              │  │
│                                        │           ▼              │  │
│                                        │  priced  /  refused      │  │
│                                        └──────────────────────────┘  │
│                                                                      │
│         TensorCommit proves the agent's reasoning at every block.    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Why this matters

The 2022 Mango Markets exploit drained $116M because Aave-shaped lending logic accepted a price its own users had already manipulated. The fix the industry chose was bigger oracles — more nodes, longer TWAPs, more aggregation. None of that addresses the structural issue: the contract has no way to decide whether the price it received corresponds to anything real.

A SHIP agent does. It reads Coinbase's order book, Binance's ticker, and a Uniswap pool, weights them by depth, and either returns a single reconciled price or refuses. The contract doesn't get to negotiate — if the agent refuses, the price feed reports `decision = REFUSED` and Aave's safety checks revert.

## Layout

| Path | Purpose |
|------|---------|
| `contracts/lib/aave-v3-core/` | Vendored Aave V3, no patches. The diff to upstream is empty by design. |
| `contracts/src/AgentPriceFeed.sol` | Chainlink-shaped feed contract. Storage written by the SHIP agent via `evm_call`. |
| `contracts/script/` | Foundry scripts: deploy Aave, deploy feed, configure WETH market. |
| `agents/price_oracle.ship` | The agent. Schedule-driven, multi-venue, depth-weighted reconciliation, refusal on divergence. |
| `agents/PRICE_ORACLE_SOUL.md` | Identity prompt for the agent. |
| `agents/RECONCILIATION_POLICY.md` | The decision logic the agent reasons over. |
| `tools/` | Custom tool implementations the agent depends on (`coinbase_orderbook`, `binance_ticker`, `uniswap_twap`). |
| `cli/` | Rust CLI: `op deposit`, `op borrow`, `op liquidate`, `op tamper`, `op status`. |
| `pallets/tool-override/` | FRAME pallet backing `op tamper` (demo-only; do not ship to mainnet). |
| `ui/` | Next.js demo UI: live feed, three venue cards with tamper, Aave position, decision timeline. Has a fully-working mock mode for screenshots before the chain integration lands. |
| `scripts/` | `setup_demo.sh`, `demo.sh` — one-shot reproduction of the full scenario. |

## SHIP ↔ EVM bridge

Theseus's EVM compatibility runs on **`pallet-revive`** (PolkaVM, RISC-V), not Frontier `pallet-evm`. Solidity contracts compile via `resolc` (Parity's Solidity-to-PolkaVM compiler) and run unmodified at the source level. The Ethereum-compatible JSON-RPC is exposed via the `eth-rpc` proxy on port 8545.

This PoC assumes the runtime exposes a precompile / tool we call `evm_call(target, calldata, value)` from SHIP, dispatching as `pallet_revive::Pallet::call` with the agent's mapped address as `msg.sender`. The mapping is deterministic per AccountId so the contract sees a stable caller across cycles.

The canonical reference for the EVM stack is [`github.com/Theseuschain/theseus-layerzero-evm`](https://github.com/Theseuschain/theseus-layerzero-evm) — the LayerZero bridge contracts use the same `resolc` + foundry-polkadot toolchain we adopt here.

## Demo

```bash
./scripts/setup_demo.sh
# starts a local Theseus node, deploys Aave V3 + AgentPriceFeed, registers price_oracle agent

op deposit 1
op borrow 1500
# both succeed; the agent's reconciled price is around $3500/ETH

op tamper uniswap --price 100000
# overrides the agent's Uniswap reading with a manipulated value

# wait one schedule tick (~60s)
op status
# AgentPriceFeed.decision == REFUSED
# reason: "uniswap divergent from coinbase by 28x"

op borrow 100
# reverts: PriceRefused(0x...)

op liquidate <user> USDC 100
# reverts: PriceRefused(0x...)
```

## Status

v0 — work in progress. See [`STATUS.md`](./STATUS.md) for what's wired up vs. stubbed.

## License

MIT.
