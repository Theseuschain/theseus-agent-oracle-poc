//! Aave V3 interactions on Theseus EVM.
//!
//! These functions wrap the standard Aave V3 entry points (`Pool.supply`,
//! `Pool.borrow`, `Pool.liquidationCall`, etc.) using the alloy EVM client.
//! No business logic lives here — Aave V3's contracts (vendored, unmodified)
//! handle everything once we hand them the right calldata.

use crate::config::Config;
use anyhow::Result;
use alloy::{
    primitives::{Address, U256},
    providers::{Provider, ProviderBuilder, WalletProvider},
    signers::local::PrivateKeySigner,
    sol,
};
use std::str::FromStr;

// Minimal interface bindings — full Aave ABIs are in lib/aave-v3-core.
sol! {
    #[sol(rpc)]
    interface IPool {
        function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
        function withdraw(address asset, uint256 amount, address to) external returns (uint256);
        function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external;
        function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256);
        function liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken) external;
        function getUserAccountData(address user) external view returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
    }

    #[sol(rpc)]
    interface IERC20 {
        function approve(address spender, uint256 amount) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
    }

    #[sol(rpc)]
    interface IAgentPriceFeed {
        function latestAnswer() external view returns (int256);
        function latestTimestamp() external view returns (uint256);
        function latestDecision() external view returns (uint8);
        function rounds(uint80 roundId) external view returns (
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint8 decision,
            bytes32 reasonHash
        );
        function latestRoundId() external view returns (uint80);
    }
}

const VARIABLE_RATE_MODE: U256 = U256::from_limbs([2, 0, 0, 0]);

fn provider(cfg: &Config) -> Result<impl Provider> {
    let signer = PrivateKeySigner::from_str(&cfg.private_key)?;
    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .wallet(signer)
        .on_http(cfg.evm_rpc.parse()?);
    Ok(provider)
}

fn parse_amount(s: &str, decimals: u8) -> Result<U256> {
    let (whole, frac) = s.split_once('.').unwrap_or((s, ""));
    let whole: U256 = whole.parse()?;
    let frac_padded = format!("{:0<width$}", frac, width = decimals as usize);
    let frac: U256 = if frac_padded.is_empty() { U256::ZERO } else { frac_padded.parse()? };
    Ok(whole * U256::from(10u128.pow(decimals.into())) + frac)
}

pub async fn deposit(cfg: &Config, amount_eth: &str) -> Result<()> {
    let provider = provider(cfg)?;
    let pool: Address = cfg.pool.parse()?;
    let weth: Address = cfg.weth.parse()?;

    let amount = parse_amount(amount_eth, 18)?;

    // 1. Approve Pool to spend our WETH.
    let token = IERC20::new(weth, &provider);
    token.approve(pool, amount).send().await?.watch().await?;

    // 2. Supply.
    let pool_iface = IPool::new(pool, &provider);
    let from = provider.default_signer_address();
    pool_iface
        .supply(weth, amount, from, 0)
        .send().await?.watch().await?;

    println!("supplied {} WETH", amount_eth);
    Ok(())
}

pub async fn borrow(cfg: &Config, amount_usdc: &str) -> Result<()> {
    let provider = provider(cfg)?;
    let pool: Address = cfg.pool.parse()?;
    let usdc: Address = cfg.usdc.parse()?;
    let amount = parse_amount(amount_usdc, 6)?;

    let pool_iface = IPool::new(pool, &provider);
    let from = provider.default_signer_address();
    pool_iface
        .borrow(usdc, amount, VARIABLE_RATE_MODE, 0, from)
        .send().await?.watch().await?;

    println!("borrowed {} USDC", amount_usdc);
    Ok(())
}

pub async fn repay(cfg: &Config, amount_usdc: &str) -> Result<()> {
    let provider = provider(cfg)?;
    let pool: Address = cfg.pool.parse()?;
    let usdc: Address = cfg.usdc.parse()?;
    let from = provider.default_signer_address();

    // For "max", we approve the user's full USDC balance — sufficient for repayAll
    // without leaving an infinite approval lying around after the demo.
    let (approve_amount, repay_amount) = if amount_usdc == "max" {
        let balance = IERC20::new(usdc, &provider).balanceOf(from).call().await?._0;
        (balance, U256::MAX)  // U256::MAX repay tells Aave "all of it"
    } else {
        let n = parse_amount(amount_usdc, 6)?;
        (n, n)
    };

    let token = IERC20::new(usdc, &provider);
    token.approve(pool, approve_amount).send().await?.watch().await?;

    let pool_iface = IPool::new(pool, &provider);
    pool_iface
        .repay(usdc, repay_amount, VARIABLE_RATE_MODE, from)
        .send().await?.watch().await?;

    println!("repaid {}", amount_usdc);
    Ok(())
}

pub async fn withdraw(cfg: &Config, amount_eth: &str) -> Result<()> {
    let provider = provider(cfg)?;
    let pool: Address = cfg.pool.parse()?;
    let weth: Address = cfg.weth.parse()?;
    let amount = parse_amount(amount_eth, 18)?;

    let pool_iface = IPool::new(pool, &provider);
    let from = provider.default_signer_address();
    pool_iface
        .withdraw(weth, amount, from)
        .send().await?.watch().await?;

    println!("withdrew {} WETH", amount_eth);
    Ok(())
}

pub async fn liquidate(
    cfg: &Config,
    user: &str,
    _debt_asset: &str,
    amount: &str,
) -> Result<()> {
    let provider = provider(cfg)?;
    let pool: Address = cfg.pool.parse()?;
    let weth: Address = cfg.weth.parse()?;
    let usdc: Address = cfg.usdc.parse()?;
    let user: Address = user.parse()?;
    let amount = parse_amount(amount, 6)?;

    let token = IERC20::new(usdc, &provider);
    token.approve(pool, amount).send().await?.watch().await?;

    let pool_iface = IPool::new(pool, &provider);
    pool_iface
        .liquidationCall(weth, usdc, user, amount, false)
        .send().await?.watch().await?;

    println!("liquidated {}", user);
    Ok(())
}

pub struct FeedStatus {
    pub decision: String,
    pub price_usd: f64,
    pub updated_at_iso: String,
    pub age_seconds: u64,
    pub reason_hash: String,
}

pub async fn feed_status(cfg: &Config) -> Result<FeedStatus> {
    let provider = provider(cfg)?;
    let feed: Address = cfg.agent_price_feed.parse()?;
    let iface = IAgentPriceFeed::new(feed, &provider);

    let round_id = iface.latestRoundId().call().await?._0;
    let round = iface.rounds(round_id).call().await?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs();

    let updated = round.updatedAt.try_into().unwrap_or(0u64);
    let age = now.saturating_sub(updated);

    Ok(FeedStatus {
        decision: match round.decision {
            0 => "UNINITIALIZED",
            1 => "PRICED",
            2 => "REFUSED",
            _ => "UNKNOWN",
        }.to_string(),
        price_usd: i256_to_usd(round.answer, 8),
        updated_at_iso: format!("{}", updated),
        age_seconds: age,
        reason_hash: format!("0x{}", hex::encode(round.reasonHash.0)),
    })
}

pub struct UserPosition {
    pub weth_collateral: f64,
    pub collateral_usd: f64,
    pub usdc_debt: f64,
    pub debt_usd: f64,
    pub health_factor: f64,
}

pub async fn user_position(cfg: &Config) -> Result<UserPosition> {
    let provider = provider(cfg)?;
    let pool: Address = cfg.pool.parse()?;
    let pool_iface = IPool::new(pool, &provider);
    let from = provider.default_signer_address();

    let data = pool_iface.getUserAccountData(from).call().await?;

    // Aave V3 normalizes everything to base currency (USD * 1e8).
    Ok(UserPosition {
        weth_collateral: 0.0, // Need WETH-specific aToken balance; skip for v0 status.
        collateral_usd: u256_to_f64(data.totalCollateralBase, 8),
        usdc_debt: 0.0,
        debt_usd: u256_to_f64(data.totalDebtBase, 8),
        health_factor: u256_to_f64(data.healthFactor, 18),
    })
}

fn u256_to_f64(v: U256, decimals: u8) -> f64 {
    let s: String = v.to_string();
    let n: u128 = s.parse().unwrap_or(0);
    n as f64 / 10f64.powi(decimals.into())
}

fn i256_to_usd(v: alloy::primitives::I256, decimals: u8) -> f64 {
    let s: String = v.to_string();
    let n: i128 = s.parse().unwrap_or(0);
    n as f64 / 10f64.powi(decimals.into())
}
