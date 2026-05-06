//! Substrate-side interactions with the price oracle agent.
//!
//! Two responsibilities:
//!  1. `tamper` and `reset` — install / clear an override on a venue tool
//!     reading, via `pallet-tool-override`.
//!  2. `status` — read the override pallet's storage to report whether a
//!     tamper is active.
//!
//! Uses subxt's dynamic API so we don't need pre-generated metadata bindings.
//! When the metadata changes, the only thing that breaks is the storage / call
//! resolution at runtime — caught by the first `op tamper` invocation.

use crate::config::Config;
use anyhow::{anyhow, Context, Result};
use parity_scale_codec::Encode;
use subxt::{
    dynamic::{self, Value},
    OnlineClient, PolkadotConfig,
};
use subxt_signer::sr25519::dev;

pub struct AgentStatus {
    pub next_run_block: u64,
    pub next_run_eta: u64,
    pub tamper_active: bool,
}

/// What the SHIP-side `VenueReading` struct looks like on the wire.
/// Layout must match the agent's declared struct exactly (field names + order).
/// SCALE serialization is field-order-sensitive.
#[derive(Encode)]
struct VenueReadingWire {
    venue: String,
    price_usd: i128,        // scaled by 1e8 to avoid fixed-point ambiguity
    depth_usd: u128,        // scaled by 1e2
    timestamp: u64,
    ok: bool,
    error: Option<String>,
}

pub async fn tamper(cfg: &Config, venue: &str, price: f64, runs: u32) -> Result<()> {
    let api = OnlineClient::<PolkadotConfig>::from_url(&cfg.substrate_ws)
        .await
        .with_context(|| format!("connecting to {}", cfg.substrate_ws))?;

    let agent_account = parse_ss58_or_hex(&cfg.agent_id)?;

    let tool_name = match venue {
        "coinbase" => "coinbase_orderbook",
        "binance"  => "binance_ticker",
        "uniswap"  => "uniswap_twap",
        other => return Err(anyhow!("unknown venue: {other}")),
    };

    // A manipulated reading. Depth is set high so the agent's depth-weighted
    // median can't filter the override out as "thin"; the divergence check is
    // what should fire instead. That's the *correct* failure mode to demo.
    let fake = VenueReadingWire {
        venue: venue.to_string(),
        price_usd: (price * 1e8) as i128,
        depth_usd: (50_000_000.0 * 1e2) as u128,
        timestamp: now_seconds(),
        ok: true,
        error: None,
    };
    let value_bytes = fake.encode();

    let tx = dynamic::tx(
        "ToolOverride",
        "override_tool",
        vec![
            Value::from_bytes(agent_account.clone()),
            Value::from_bytes(tool_name.as_bytes()),
            Value::from_bytes(value_bytes),
            Value::u128(runs as u128),
        ],
    );

    // Use Alice as admin in the dev network. In a real deployment, the admin
    // origin is whatever sudo / multisig the runtime configures.
    let signer = dev::alice();
    let progress = api
        .tx()
        .sign_and_submit_then_watch_default(&tx, &signer)
        .await?;
    let in_block = progress.wait_for_in_block().await?;
    in_block.wait_for_success().await?;

    println!(
        "[tamper] {} -> ${:.2} for the next {} agent run(s) (in block {:#?})",
        venue,
        price,
        runs,
        in_block.block_hash()
    );
    Ok(())
}

pub async fn reset(cfg: &Config) -> Result<()> {
    let api = OnlineClient::<PolkadotConfig>::from_url(&cfg.substrate_ws).await?;
    let agent_account = parse_ss58_or_hex(&cfg.agent_id)?;

    let tx = dynamic::tx(
        "ToolOverride",
        "clear_overrides",
        vec![Value::from_bytes(agent_account)],
    );

    let signer = dev::alice();
    let progress = api
        .tx()
        .sign_and_submit_then_watch_default(&tx, &signer)
        .await?;
    progress.wait_for_in_block().await?.wait_for_success().await?;

    println!("[reset] cleared all tamper overrides");
    Ok(())
}

pub async fn status(cfg: &Config) -> Result<AgentStatus> {
    let api = OnlineClient::<PolkadotConfig>::from_url(&cfg.substrate_ws).await?;
    let agent_account = parse_ss58_or_hex(&cfg.agent_id)?;

    // Iterate the (agent, _) prefix of ToolOverride.Overrides to detect any
    // active tamper.
    let storage_query = dynamic::storage(
        "ToolOverride",
        "Overrides",
        vec![Value::from_bytes(agent_account.clone())],
    );

    let mut iter = api
        .storage()
        .at_latest()
        .await?
        .iter(storage_query)
        .await?;

    let mut tamper_active = false;
    while let Some(_entry) = iter.next().await {
        tamper_active = true;
        break;
    }

    // The next-run block lives in whatever scheduler pallet the SHIP runtime
    // uses. Without confirmed metadata for that, surface zeros and let the
    // user infer from "did the price update recently?".
    Ok(AgentStatus {
        next_run_block: 0,
        next_run_eta: 0,
        tamper_active,
    })
}

fn parse_ss58_or_hex(s: &str) -> Result<Vec<u8>> {
    let s = s.trim();
    if let Some(stripped) = s.strip_prefix("0x") {
        return hex::decode(stripped).context("hex decode");
    }

    // ss58 → public-key bytes. sp_core::crypto::AccountId32 from str handles ss58.
    let acct = sp_core::crypto::AccountId32::from_string(s)
        .map_err(|e| anyhow!("not ss58 or hex: {s} ({e:?})"))?;
    let bytes: &[u8] = acct.as_ref();
    Ok(bytes.to_vec())
}

fn now_seconds() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
