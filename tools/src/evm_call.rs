//! EVM Call Tool — the SHIP↔PolkaVM bridge
//!
//! Documents the `evm_call` tool used by `agents/price_oracle.ship` to write
//! into `AgentPriceFeed.sol` running on Theseus's `pallet-revive` (PolkaVM,
//! not Frontier `pallet-evm`).
//!
//! ## Tool Signature
//!
//! ```ship
//! tool evm_call(target: address, data: bytes, value: number) -> bytes;
//! ```
//!
//! ## Status
//!
//! **This is the one runtime dependency this PoC adds beyond the existing
//! Theseus example repos.** Everything else (`fetch_url`, `web_search`,
//! `get_price`, `agents_request` chain extension) already exists in the
//! Theseus tool-executor and runtime. `evm_call` does not.
//!
//! Theseus's EVM compatibility comes from `pallet-revive` (PolkaVM, RISC-V
//! VM with an Ethereum-compatible JSON-RPC at the `eth-rpc` proxy). Solidity
//! deploys go through `resolc` (Parity's Solidity-to-PolkaVM compiler);
//! Solidity contracts run unmodified at the source level. The bridge from
//! a SHIP agent into a deployed contract is a `pallet-revive::Pallet::call`
//! dispatch, not the Frontier `pallet-evm::Pallet::call`.
//!
//! Sketch:
//!
//! ```rust
//! // tool-executor/src/tools/evm_call.rs
//! impl Tool for EvmCallTool {
//!     fn name(&self) -> &str { "evm_call" }
//!
//!     fn execute(&self, ctx: &mut ToolContext, args: &Args) -> Result<Output> {
//!         let target: H160 = args.get("target")?.as_evm_address()?;
//!         let data: Bytes  = args.get("data")?.as_bytes()?;
//!         let value: U256  = args.get("value")?.as_u256()?;
//!
//!         // Map the SHIP agent's substrate AccountId32 to its EVM-mapped
//!         // address. pallet-revive uses a deterministic mapping so the
//!         // contract sees the same address every cycle.
//!         let from = derive_evm_address(ctx.agent_id);
//!
//!         let result = pallet_revive::Pallet::<Runtime>::call(
//!             RawOrigin::Signed(ctx.agent_account_id.clone()).into(),
//!             target,
//!             value,
//!             /* gas_limit */    Weight::from_parts(2_000_000_000, 200_000),
//!             /* storage_deposit_limit */ None,
//!             data,
//!         )?;
//!
//!         Ok(Output::bytes(result.data))
//!     }
//! }
//! ```
//!
//! ## Auth model
//!
//! `AgentPriceFeed.onlyAgent` enforces that only the SHIP agent's mapped
//! address can write the price. pallet-revive's address mapping is
//! deterministic per AccountId, so the mapping persists across runs and any
//! other SHIP agent calling the same contract gets a different `msg.sender`
//! and reverts.
//!
//! ## What this assumes about Theseus's runtime
//!
//! 1. **`pallet-revive` is in `construct_runtime!`.** Confirmed via the
//!    LayerZero EVM repo (the bridge contracts deploy to pallet-revive).
//! 2. **`eth-rpc` proxy is running** in the dev environment, exposing
//!    Ethereum-compatible JSON-RPC on port 8545 (this is what viem/alloy
//!    talk to from the UI / tests).
//! 3. **The agent's substrate AccountId maps to a stable EVM address.**
//!    pallet-revive's default AccountId-to-H160 mapping handles this.
//!
//! ## Reverse direction (EVM → SHIP)
//!
//! Out of scope for v0. The PoC uses a **push** model: the agent pushes
//! prices on a schedule, the EVM contract reads cached storage. A pull
//! model (Aave calls SHIP via precompile) is more elegant but requires
//! either a synchronous chain extension or a request/response pattern
//! across blocks. Push is enough to demonstrate the thesis.
//!
//! ## Reference: Theseus EVM tooling
//!
//! - github.com/Theseuschain/theseus-layerzero-evm — the LayerZero bridge
//!   EVM contracts. Same Solidity-to-PolkaVM toolchain (`resolc`,
//!   foundry-polkadot, dual `default` and `pvm` foundry profiles).
//! - github.com/theseus-network/theseus-chain — the Substrate runtime that
//!   includes `pallet-revive`, the agent runtime, and the eth-rpc proxy.
