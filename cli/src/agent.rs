//! Substrate-side interactions with the price oracle agent.
//!
//! Two responsibilities:
//!  1. `tamper` and `reset` — swap one of the agent's tools for a manipulated
//!     stub, then restore. This is the demo lever.
//!  2. `status` — read the agent's next-scheduled-block and current tamper state
//!     from chain storage.
//!
//! The agent's "tamper" mechanism is the one piece of demo-only scaffolding in
//! this PoC. It works by registering an alternate tool implementation in the
//! tool-executor (e.g. `coinbase_orderbook_stub_$override`) and re-pointing
//! the agent's tool resolution table for N runs. In production, no such
//! mechanism exists — tools are bound at deploy time.

use crate::config::Config;
use anyhow::Result;

pub struct AgentStatus {
    pub next_run_block: u64,
    pub next_run_eta: u64,
    pub tamper_active: bool,
}

pub async fn tamper(_cfg: &Config, venue: &str, price: f64, runs: u32) -> Result<()> {
    // TODO: subxt extrinsic — call into the demo tamper pallet:
    //
    //   ToolOverridePallet::override_tool(
    //       agent_id,
    //       tool_name = "<venue>_orderbook" | "<venue>_ticker" | "<venue>_twap",
    //       override = ManipulatedConstant { price_usd: price },
    //       expires_after_runs: runs,
    //   );
    //
    // The demo pallet is an additional runtime component we build for the
    // PoC — it lives behind a feature flag and is not part of the production
    // tool-executor.
    println!(
        "[tamper] {} → ${:.2} for the next {} agent run(s)",
        venue, price, runs
    );
    println!("(stub: subxt call to ToolOverridePallet::override_tool)");
    Ok(())
}

pub async fn reset(_cfg: &Config) -> Result<()> {
    // TODO: subxt extrinsic — ToolOverridePallet::clear_overrides(agent_id).
    println!("[reset] cleared all tamper overrides");
    println!("(stub: subxt call to ToolOverridePallet::clear_overrides)");
    Ok(())
}

pub async fn status(_cfg: &Config) -> Result<AgentStatus> {
    // TODO: subxt query — read:
    //   - SchedulerPallet::next_run(agent_id)
    //   - ToolOverridePallet::active_overrides(agent_id)
    //
    // For now, return a placeholder.
    Ok(AgentStatus {
        next_run_block: 0,
        next_run_eta: 0,
        tamper_active: false,
    })
}
