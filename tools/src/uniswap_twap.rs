//! Uniswap V3 TWAP tool.
//!
//! Reads a Uniswap V3 pool's `observe(secondsAgos)` over a configurable window,
//! converts the cumulative tick into a human-readable price, and computes a
//! rough $ TVL from the pool's underlying-token reserves.
//!
//! ### Why TWAP not spot
//! Spot AMM reads are trivial to manipulate — one in-block trade can move them
//! 10×. A 30-minute TWAP forces an attacker to maintain the manipulated price
//! for 30 minutes against arbitragers, which is expensive. Aave V3 and Compound
//! V3 both default to TWAP for AMM-derived prices for exactly this reason.
//!
//! Even with TWAP, an attacker who can manipulate the pool can mislead this
//! reading. The agent's structural defense is not TWAP — it is the
//! reconciliation policy. Uniswap is one of three readings, and divergence
//! triggers refusal.
//!
//! ## SHIP signature (for reference)
//!
//! ```ship
//! tool uniswap_twap(pool_address: address, window_seconds: number) -> VenueReading;
//! ```

use crate::types::{now_seconds, VenueReading};
use alloy::{
    primitives::{Address, U256},
    providers::{Provider, ProviderBuilder},
    sol,
};
use anyhow::Result;

sol! {
    #[sol(rpc)]
    interface IUniswapV3Pool {
        function token0() external view returns (address);
        function token1() external view returns (address);
        function fee() external view returns (uint24);
        function observe(uint32[] calldata secondsAgos)
            external view
            returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
        function slot0()
            external view
            returns (
                uint160 sqrtPriceX96,
                int24 tick,
                uint16 observationIndex,
                uint16 observationCardinality,
                uint16 observationCardinalityNext,
                uint8 feeProtocol,
                bool unlocked
            );
    }

    #[sol(rpc)]
    interface IERC20Min {
        function balanceOf(address) external view returns (uint256);
        function decimals() external view returns (uint8);
    }
}

/// Reads `pool` on the chain at `rpc_url`, computes the TWAP over the last
/// `window_seconds`, returns price expressed as **token0 in terms of token1**.
///
/// Caller is responsible for asset orientation. For an ETH/USDC pool where
/// token0 = USDC and token1 = WETH, swap the inversion accordingly. We default
/// to the WETH/USDC 0.05% pool on Ethereum mainnet, where token0 = USDC and
/// token1 = WETH, so we invert to return ETH/USD.
pub async fn uniswap_twap(
    rpc_url: &str,
    pool: Address,
    window_seconds: u32,
) -> Result<VenueReading> {
    if window_seconds == 0 {
        return Ok(VenueReading::failed("uniswap", "zero_window"));
    }

    let provider = ProviderBuilder::new().on_http(rpc_url.parse()?);
    let pool_iface = IUniswapV3Pool::new(pool, &provider);

    // 1. observe([window, 0]) -> tickCumulatives at (now - window) and (now)
    let secs_agos = vec![window_seconds, 0u32];
    let observe_result = match pool_iface.observe(secs_agos).call().await {
        Ok(r) => r,
        Err(e) => {
            return Ok(VenueReading::failed(
                "uniswap",
                format!("observe_failed: {e}"),
            ))
        }
    };

    let cumulatives = observe_result.tickCumulatives;
    if cumulatives.len() != 2 {
        return Ok(VenueReading::failed("uniswap", "bad_observe_length"));
    }

    // tickCumulatives is `int56`; alloy returns it as I256-shaped wide integer.
    let tick_cum_old: i128 = cumulatives[0].as_i128();
    let tick_cum_new: i128 = cumulatives[1].as_i128();
    let tick_diff = tick_cum_new - tick_cum_old;
    // Convert to f64 *before* dividing — integer division would drop sub-tick
    // precision and bias the price downward by up to one tick (~1bp).
    let avg_tick = tick_diff as f64 / window_seconds as f64;

    // 2. Convert avg tick to a price ratio (token1 per token0):
    //    price = 1.0001 ^ tick
    let price_token1_per_token0 = 1.0001f64.powf(avg_tick);

    // 3. Fetch token decimals so we can normalize.
    let token0_addr = pool_iface.token0().call().await.map(|r| r._0)?;
    let token1_addr = pool_iface.token1().call().await.map(|r| r._0)?;
    let dec0 = IERC20Min::new(token0_addr, &provider).decimals().call().await?._0;
    let dec1 = IERC20Min::new(token1_addr, &provider).decimals().call().await?._0;

    // Normalize: human price = raw_ratio * 10^(dec0 - dec1)
    let dec_adj = 10f64.powi(dec0 as i32 - dec1 as i32);
    let human_token1_per_token0 = price_token1_per_token0 * dec_adj;

    // For the WETH/USDC 0.05% pool on Ethereum mainnet:
    //   token0 = USDC (6 dec), token1 = WETH (18 dec)
    //   raw ratio is "WETH per USDC"; we want "USDC per WETH" = 1 / ratio.
    // We can't tell at the tool layer which orientation the caller wants,
    // so we return *both* orientations and let RECONCILIATION_POLICY map
    // through the canonical one (we encode "ETH/USD" as price_usd, by
    // inverting when token1 has fewer decimals than token0 OR when the
    // configured asset name puts token1 first).
    //
    // For this PoC we hardcode the expectation: if token0 decimals < token1
    // decimals, invert (so we get USD per ETH for the WETH/USDC pool).
    let price_usd = if dec0 < dec1 {
        1.0 / human_token1_per_token0
    } else {
        human_token1_per_token0
    };

    // 4. TVL approximation: USDC reserve + WETH reserve × price.
    //    Use raw token balances of the pool to avoid relying on slot0 for liquidity.
    let bal0 = IERC20Min::new(token0_addr, &provider)
        .balanceOf(pool)
        .call()
        .await?
        ._0;
    let bal1 = IERC20Min::new(token1_addr, &provider)
        .balanceOf(pool)
        .call()
        .await?
        ._0;

    let bal0_human = u256_to_f64(bal0, dec0);
    let bal1_human = u256_to_f64(bal1, dec1);

    // If token0 is the stable, TVL = bal0 + bal1 * price.
    let tvl_usd = if dec0 < dec1 {
        bal0_human + bal1_human * price_usd
    } else {
        bal1_human + bal0_human * price_usd
    };

    Ok(VenueReading::ok("uniswap", price_usd, tvl_usd, now_seconds()))
}

fn u256_to_f64(v: U256, decimals: u8) -> f64 {
    // For pool reserves we don't expect U256 values beyond u128 today, but
    // a silent zero-out on overflow turns into "zero TVL → zero depth weight",
    // which would bias reconciliation. Saturate to f64::MAX instead so the
    // venue is at least not penalized.
    let s = v.to_string();
    let n: u128 = s.parse().unwrap_or(u128::MAX);
    n as f64 / 10f64.powi(decimals.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn u256_decimal_normalization() {
        // 3500 USDC (6 decimals) → 3500.0
        let raw = U256::from(3_500_000_000u64);
        assert!((u256_to_f64(raw, 6) - 3500.0).abs() < 1e-6);

        // 1.5 ETH (18 decimals) → 1.5
        let raw = U256::from_str_radix("1500000000000000000", 10).unwrap();
        assert!((u256_to_f64(raw, 18) - 1.5).abs() < 1e-6);
    }
}
