# `pallet-tool-override`

Demo-only FRAME pallet that lets a privileged origin install a fake reading for
a specific agent's specific tool, valid for N future runs of that agent.

This is the back-end for `op tamper` — the CLI lever that swaps in a manipulated
Uniswap (or Coinbase, or Binance) reading so we can demonstrate the agent
correctly refusing to price.

## Integration into the Theseus runtime

In the runtime crate (the one that calls `construct_runtime!`):

1. Add the dependency:

   ```toml
   pallet-tool-override = { path = "../../pallets/tool-override", default-features = false }
   ```
   And in `[features]`:
   ```toml
   std = [..., "pallet-tool-override/std"]
   ```

2. Configure the pallet:

   ```rust
   impl pallet_tool_override::Config for Runtime {
       type RuntimeEvent = RuntimeEvent;
       type AdminOrigin  = EnsureRoot<AccountId>;     // or a sudo-equivalent
       type TickOrigin   = EnsureSignedBy<ToolExecutorOrigin, AccountId>;
   }
   ```

3. Add to `construct_runtime!`:

   ```rust
   construct_runtime!(
       pub enum Runtime {
           // ...
           ToolOverride: pallet_tool_override,
       }
   );
   ```

4. Wire the tool-executor to call `Pallet::<Runtime>::resolve(agent, tool)`
   before dispatching the real tool, and `tick(agent)` at the start of each
   scheduled run.

## Why a separate pallet, not a runtime config flag

Operationally cleaner: the pallet has its own storage, its own events, its own
admin origin. Disabling the demo is one `construct_runtime!` removal away;
nothing else touches it. **Don't ship to mainnet.** The pallet has no honest
production role.

## What it doesn't do

- It doesn't manipulate consensus, randomness, or block production.
- It doesn't bypass TensorCommit — the agent's reasoning is still committed.
  The override only changes what the tool returns; the agent still reasons
  about that input and (in our case) still concludes `refused` because the
  reconciliation policy fires.
- It doesn't sign transactions on behalf of the agent.
