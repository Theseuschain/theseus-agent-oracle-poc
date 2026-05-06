//! EVM Call Tool — the SHIP↔EVM bridge
//!
//! Documents the `evm_call` tool used by `agents/price_oracle.ship` to write
//! into `AgentPriceFeed.sol` on Theseus's `pallet-evm`.
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
//! `the-prediction-market` example.** Everything else (`fetch_url`,
//! `web_search`, `get_price`, `agents_request` chain extension) already exists
//! in the Theseus tool-executor and runtime. `evm_call` does not.
//!
//! The pattern is well-established in Substrate: Moonbeam exposes a
//! `XcmTransactor` precompile and Astar exposes `Wasm-XCM` precompiles for
//! cross-VM calls. For our purposes the simpler version suffices:
//!
//! ```rust
//! // tool-executor/src/tools/evm_call.rs (sketch)
//! impl Tool for EvmCallTool {
//!     fn name(&self) -> &str { "evm_call" }
//!
//!     fn execute(&self, ctx: &mut ToolContext, args: &Args) -> Result<Output> {
//!         let target: H160 = args.get("target")?.as_evm_address()?;
//!         let data: Bytes  = args.get("data")?.as_bytes()?;
//!         let value: U256  = args.get("value")?.as_u256()?;
//!
//!         // Map the SHIP agent's substrate address to its EVM-mapped address.
//!         // Same scheme Frontier uses for ethereum-compatible addresses.
//!         let from = derive_evm_address(ctx.agent_id);
//!
//!         let result = pallet_evm::Pallet::<Runtime>::call(
//!             RawOrigin::EvmCall(from).into(),
//!             from, target, data, value,
//!             /* gas_limit */    1_500_000,
//!             /* max_fee_per_gas */ U256::from(1_000_000_000),
//!             /* max_priority_fee_per_gas */ None,
//!             /* nonce */        None,
//!             /* access_list */  Vec::new(),
//!         )?;
//!
//!         Ok(Output::bytes(result.value))
//!     }
//! }
//! ```
//!
//! ## Auth model
//!
//! The receiving EVM contract sees `msg.sender == derive_evm_address(agent_id)`,
//! so `AgentPriceFeed.onlyAgent` enforces that only this specific SHIP agent
//! can write the price. Any other SHIP agent calling the same contract would
//! get a different EVM address and revert.
//!
//! ## What this assumes about Theseus's pallet-evm config
//!
//! 1. **Standard Frontier `pallet-evm`** — confirmed by the user.
//! 2. **EVM-address-mapping for AccountIds** — Theseus runtime must derive a
//!    deterministic EVM address from a SHIP agent's substrate-style AccountId.
//!    The standard pattern is `H160::from_slice(&blake2_256(account_id)[0..20])`,
//!    which is what Astar and Moonbeam use.
//! 3. **No EOA balance required for gas** — the agent's calls should be paid
//!    from its substrate account or sponsored by the chain. Frontier supports
//!    this via the `EnsureAddressTruncated` config or a dispatch wrapper.
//!
//! If any of these don't match Theseus's actual runtime, `evm_call` is the only
//! file that needs to change.
//!
//! ## Reverse direction (EVM → SHIP)
//!
//! Out of scope for v0. The PoC uses a **push** model: the agent pushes prices
//! on a schedule, the EVM contract reads cached storage. A pull model
//! (Aave calls SHIP via precompile) is more elegant but requires either a
//! synchronous chain extension or a request/response pattern across blocks.
//! Push is enough to demonstrate the thesis.
