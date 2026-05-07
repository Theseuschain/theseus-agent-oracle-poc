# UI ↔ Theseus integration

How the Next.js app connects to a running Theseus chain. Everything below is
the **live mode** wiring — pull any deployment env var and the UI falls back
to client-owned mock state automatically.

This document is the source of truth for every assumption the UI makes about
the runtime. If something on the Theseus side changes, this is the file to
reread.

## Conventions inherited from the Theseus example repos

The UI follows the patterns in:
- [`Theseuschain/the-prediction-market`](https://github.com/Theseuschain/the-prediction-market) — agent + Wasm contract pattern
- [`Theseuschain/proof-of-lobster`](https://github.com/Theseuschain/proof-of-lobster) — agent deploy flow
- [`Theseuschain/theseus-layerzero-evm`](https://github.com/Theseuschain/theseus-layerzero-evm) — EVM (PolkaVM) deploy toolchain

| Concern | Convention |
|---------|-----------|
| Substrate WS RPC | `ws://127.0.0.1:9944` |
| EVM JSON-RPC | `http://127.0.0.1:8545` (the `eth-rpc` proxy in front of `pallet-revive`) |
| Admin signer URI | `//Alice` in dev (`sr25519`) |
| Agent registration | `theseus-cli deploy-agent agents/price_oracle.ship` |
| Deployed addresses | persisted to `contracts/deployments/*.txt` by `scripts/setup_demo.sh` |
| Substrate library | `@polkadot/api` (server) — equivalent of subxt in JS |
| EVM library | `viem` (server + client) |
| EVM compiler | Parity's `foundry-polkadot` (`forge` with `resolc` support) |
| Foundry profile | `pvm` profile for Theseus deploys, `default` for vanilla EVM tests |

### Why `pallet-revive` and not `pallet-evm`

Theseus runs on Polkadot's PolkaVM (RISC-V) rather than the Ethereum Virtual Machine. `pallet-revive` is the runtime module that hosts PolkaVM contracts. Solidity compiles unmodified at the source level via `resolc` (Parity's Solidity-to-PolkaVM compiler) — vanilla `forge build` won't produce deployable bytecode. The user-facing JSON-RPC is still Ethereum-compatible (`eth_chainId`, `eth_call`, `eth_sendRawTransaction`, etc.) via the `eth-rpc` proxy, so viem/wagmi work end-to-end.

## Deployment artifacts the UI reads

After `./scripts/setup_demo.sh` finishes, the following files exist under
`contracts/deployments/` and are loaded into env vars before `npm run dev`:

| File | Env var | Purpose |
|------|---------|---------|
| `AgentId.txt` | `NEXT_PUBLIC_AGENT_ID` | Agent's substrate AccountId32 (ss58 or 0x-hex). Identifies the agent in `pallet-tool-override`. |
| `AgentPriceFeed.txt` | `NEXT_PUBLIC_AGENT_PRICE_FEED` | The Solidity feed contract on `pallet-evm`. |
| `Pool.txt` | `NEXT_PUBLIC_POOL` | Aave V3 Pool proxy address. |
| `WETH.txt` | `NEXT_PUBLIC_WETH` | WETH9 mock (or real WETH on a non-dev deployment). |
| `USDC.txt` | `NEXT_PUBLIC_USDC` | Mock USDC. |

In addition:

| Env var | Purpose | Sensitive? |
|---------|---------|-----------|
| `THESEUS_WS` | substrate WS endpoint | server-only |
| `ADMIN_SEED` | sr25519 seed for tamper / reset extrinsics | **yes — mark Sensitive on Vercel** |
| `NEXT_PUBLIC_EVM_RPC` | EVM RPC endpoint | public |
| `NEXT_PUBLIC_CHAIN_ID` | EVM chain ID | public |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect cloud project | public |

The single source of truth for these reads is [`src/lib/deployment.ts`](./src/lib/deployment.ts).

## Five integration points

### 1. EVM reads — `AgentPriceFeed.sol` via viem

[`src/lib/feed-state.ts`](./src/lib/feed-state.ts) reads the latest price via:

```ts
publicClient.readContract({
  address: ADDRESSES.feed,
  abi: FEED_ABI,
  functionName: "rounds",
  args: [latestRoundId],
});
```

Returned tuple: `(answer, startedAt, updatedAt, decision, reasonHash)`.
`decision` is the `enum` from the Solidity contract — `0=UNINITIALIZED`,
`1=PRICED`, `2=REFUSED`.

**Assumption:** the `eth-rpc` proxy is running and exposes the Ethereum-
compatible JSON-RPC at `NEXT_PUBLIC_EVM_RPC` (default `http://127.0.0.1:8545`).
For non-local deployments, point at the public RPC URL of the Theseus
network's `eth-rpc` instance. The `NEXT_PUBLIC_CHAIN_ID` should match the
chain ID `eth-rpc` reports (default `420420420` for Theseus devnet).

### 2. Live timeline — feed events via `viem.getContractEvents`

[`src/lib/feed-events.ts`](./src/lib/feed-events.ts) builds `TimelineEntry[]`
from `PriceUpdated` and `Refused` event logs over the last ~5,000 blocks.

The full reasoning blob isn't on-chain — only its `keccak256` is anchored in
the `Refused` event. The matching paragraph lives in TensorCommit; fetching
it requires a Theseus runtime endpoint that doesn't exist yet, so the live
timeline shows a placeholder ("Reasoning committed via TensorCommit at this
block") where the paragraph would render.

**TODO when the runtime exposes it:** add a `/api/reasoning?hash=…` route
that fetches the blob from the agent's TensorCommit store, then thread it
into the timeline entries.

### 3. Substrate writes — `pallet-tool-override` via `@polkadot/api`

[`src/lib/substrate.ts`](./src/lib/substrate.ts) wraps three extrinsics:

```ts
api.tx.toolOverride.overrideTool(agentId, toolName, valueBytes, runs);
api.tx.toolOverride.clearOverrides(agentId);
api.tx.toolOverride.tick(agent);   // not user-callable; tool-executor only
```

**Assumptions:**

- The pallet is registered in `construct_runtime!` as `ToolOverride` (see [`pallets/tool-override/README.md`](../pallets/tool-override/README.md)).
- `Config::AdminOrigin` is a privileged origin (`EnsureRoot` or sudo). **A misconfigured `EnsureSigned` origin would let any user submit overrides.**
- The runtime registers the SHIP-side `VenueReading` struct so we can SCALE-encode override values. If it doesn't, `substrate.ts` registers it client-side (see `types: { VenueReading: ... }`); the field names + order must match `agents/price_oracle.ship`.

### 4. Substrate reads — active overrides

```ts
api.query.toolOverride.overrides.entries(agentId);
```

Returns `(StorageKey, OverrideEntry)[]`. With the first key bound to
`agentId`, `key.args[0]` is the *second* map key (the tool name). We map
`coinbase_orderbook → coinbase`, `binance_ticker → binance`, etc.

### 5. Connection lifecycle

`@polkadot/api`'s `WsProvider` auto-reconnects every 5s by default. We
additionally drop our `ApiPromise` singleton on `disconnected` so the next
call rebuilds — important on Vercel where serverless instances can sit cold
for hours.

The `/api/health` endpoint probes both EVM and substrate connectivity:

```bash
curl http://localhost:3000/api/health | jq
{
  "mode": "live",
  "live": true,
  "evm": { "ok": true, "chainId": 1337 },
  "ws": { "ok": true, "chainName": "Theseus" },
  "addresses": { "agentPriceFeed": "0x...", "agentId": "5G...", ... }
}
```

When the response shape differs (mock mode, or one side disconnected), the
header badge in the UI surfaces the degraded state.

## The three demo paths in live mode

| Demo lever | Live wiring | Status |
|-----------|------------|--------|
| Tamper one venue | `api.tx.toolOverride.overrideTool` for one tool | ✅ wired |
| Pump all venues | three sequential `overrideTool` calls (one per tool) | ✅ wired |
| Halt a venue | **not yet wired** — needs a `pallet-context-events` (or repurpose `pallet-tool-override` to inject `ok: false` readings) | ⚠️ mock-only |

The halt mechanism in mock mode is pure UI state — flipping `ok = false` on
the rendered venue card. To make halts work live, either:

1. **Add a halt to the override pallet:** install an override whose
   `VenueReading` has `ok = false, error = "halted: ..."`. The agent's
   reconciliation policy already treats `ok=false` as an inactive venue.
   This needs zero new pallets.

2. **Build a `pallet-context-events`** that registers structured news
   events (halts, hacks, regulatory actions). The tool-executor injects
   these into the agent's prompt. More general, more work.

Option 1 is the path of least resistance and requires no runtime changes
beyond what's already documented.

## Runtime integration checklist

The four items still blocking live end-to-end execution. Each is documented
in [`STATUS.md`](../STATUS.md) and the linked drop-in artifacts:

1. ✅ `pallet-tool-override` — drop-in at [`pallets/tool-override/`](../pallets/tool-override/).
2. ⚠️ Tool implementations registered with the tool-executor — drop-in at [`tools/src/`](../tools/src/).
3. ⚠️ `evm_call` precompile/tool — spec at [`tools/src/evm_call.rs`](../tools/src/evm_call.rs).
4. ⚠️ Tool-executor calls `Pallet::resolve(agent, tool)` before each dispatch and `tick(agent)` at the start of each scheduled run.

Once those land, set the env vars from `.env.example`, redeploy on Vercel,
and the `mock data` badge flips to `live chain`.

## Where to look when something breaks

| Symptom | First file to check |
|---------|---------------------|
| Tamper button does nothing | `substrate.ts` connection probe + `/api/health` |
| Feed shows mock data with deployment configured | `deployment.ts` env var loading |
| Live timeline empty | `feed-events.ts` block-range + RPC reachability |
| Override extrinsic reverts | runtime's `pallet-tool-override` integration; `substrate.ts` error logs the `module.error` decoded name |
| EVM contracts not found | `chain.ts` — the addresses come from `getBrowserConfig()` |
