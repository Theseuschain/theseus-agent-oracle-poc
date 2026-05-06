//! Coinbase order-book tool.
//!
//! Reads `GET /products/{symbol}/book?level=2` (public, no auth) and computes
//! a depth-weighted mid + $ liquidity within 50bps. The 50bps depth window
//! mirrors the divergence threshold the agent uses in RECONCILIATION_POLICY.md
//! — readings outside that window aren't useful, so we don't pay to compute them.
//!
//! Output: `VenueReading { venue: "coinbase", .. }`.
//!
//! ## SHIP signature (for reference)
//!
//! ```ship
//! tool coinbase_orderbook(symbol: string) -> VenueReading;
//! ```

use crate::types::{now_seconds, VenueReading};
use anyhow::{Context, Result};
use serde::Deserialize;

const DEFAULT_BASE_URL: &str = "https://api.exchange.coinbase.com";
const DEPTH_BPS: f64 = 50.0;
const HTTP_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

#[derive(Debug, Deserialize)]
struct BookResponse {
    /// Each level is [price_str, size_str, num_orders].
    bids: Vec<[serde_json::Value; 3]>,
    asks: Vec<[serde_json::Value; 3]>,
}

pub async fn coinbase_orderbook(symbol: &str) -> Result<VenueReading> {
    coinbase_orderbook_with_base(symbol, DEFAULT_BASE_URL).await
}

pub async fn coinbase_orderbook_with_base(symbol: &str, base_url: &str) -> Result<VenueReading> {
    let url = format!("{}/products/{}/book?level=2", base_url, symbol);

    let client = reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .context("building reqwest client")?;

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return Ok(VenueReading::failed("coinbase", format!("network: {e}"))),
    };

    if !resp.status().is_success() {
        return Ok(VenueReading::failed(
            "coinbase",
            format!("http {}", resp.status().as_u16()),
        ));
    }

    let body: BookResponse = match resp.json().await {
        Ok(b) => b,
        Err(e) => return Ok(VenueReading::failed("coinbase", format!("decode: {e}"))),
    };

    let bids = parse_levels(&body.bids);
    let asks = parse_levels(&body.asks);

    if bids.is_empty() || asks.is_empty() {
        return Ok(VenueReading::failed("coinbase", "empty_book"));
    }

    let best_bid = bids[0].0;
    let best_ask = asks[0].0;
    if best_ask <= best_bid {
        return Ok(VenueReading::failed("coinbase", "crossed_book"));
    }

    let mid = (best_bid + best_ask) / 2.0;

    // Reject obviously broken books — Coinbase normally runs spreads in the
    // single-digit bps range on majors. >5% means something is wrong.
    let spread_bps = (best_ask - best_bid) / mid * 10_000.0;
    if spread_bps > 500.0 {
        return Ok(VenueReading::failed(
            "coinbase",
            format!("book_skew_{:.0}bps", spread_bps),
        ));
    }

    let half_window = mid * DEPTH_BPS / 10_000.0;
    let bid_depth_usd: f64 = bids
        .iter()
        .take_while(|(price, _)| *price >= mid - half_window)
        .map(|(price, size)| price * size)
        .sum();
    let ask_depth_usd: f64 = asks
        .iter()
        .take_while(|(price, _)| *price <= mid + half_window)
        .map(|(price, size)| price * size)
        .sum();

    let depth_usd = bid_depth_usd + ask_depth_usd;

    Ok(VenueReading::ok("coinbase", mid, depth_usd, now_seconds()))
}

fn parse_levels(raw: &[[serde_json::Value; 3]]) -> Vec<(f64, f64)> {
    raw.iter()
        .filter_map(|level| {
            let price = level[0].as_str()?.parse::<f64>().ok()?;
            let size = level[1].as_str()?.parse::<f64>().ok()?;
            Some((price, size))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_book_levels() {
        let raw = vec![
            [
                serde_json::json!("3500.50"),
                serde_json::json!("1.5"),
                serde_json::json!(2),
            ],
            [
                serde_json::json!("3500.40"),
                serde_json::json!("0.8"),
                serde_json::json!(1),
            ],
        ];
        let parsed = parse_levels(&raw);
        assert_eq!(parsed, vec![(3500.50, 1.5), (3500.40, 0.8)]);
    }
}
