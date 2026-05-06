//! Binance ticker tool.
//!
//! Reads `GET /api/v3/ticker/24hr?symbol={symbol}` (public, no auth) and returns
//! `lastPrice` + `quoteVolume` (24h $ volume, used as a depth proxy).
//!
//! ### Caveat on depth
//! 24h volume is a worse depth proxy than an order book. To upgrade, swap the
//! REST call for `/api/v3/depth?symbol={symbol}&limit=500` and run the same
//! 50bps walk used in `coinbase_orderbook`. The agent's reconciliation policy
//! works as long as Coinbase and Binance normally agree to within 50bps —
//! which they do on majors — so the upgrade isn't load-bearing for v0.
//!
//! ## SHIP signature (for reference)
//!
//! ```ship
//! tool binance_ticker(symbol: string) -> VenueReading;
//! ```

use crate::types::VenueReading;
use anyhow::{Context, Result};
use serde::Deserialize;

const DEFAULT_BASE_URL: &str = "https://api.binance.com";
const HTTP_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

#[derive(Debug, Deserialize)]
struct TickerResponse {
    #[serde(rename = "lastPrice")]
    last_price: String,
    #[serde(rename = "quoteVolume")]
    quote_volume: String,
    #[serde(rename = "closeTime")]
    close_time: u64,
}

pub async fn binance_ticker(symbol: &str) -> Result<VenueReading> {
    binance_ticker_with_base(symbol, DEFAULT_BASE_URL).await
}

pub async fn binance_ticker_with_base(symbol: &str, base_url: &str) -> Result<VenueReading> {
    let url = format!("{}/api/v3/ticker/24hr?symbol={}", base_url, symbol);

    let client = reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .context("building reqwest client")?;

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return Ok(VenueReading::failed("binance", format!("network: {e}"))),
    };

    let status = resp.status();
    if !status.is_success() {
        // 451 from US IPs is a common, legitimate failure that operators
        // need to know about — surface the status code verbatim.
        return Ok(VenueReading::failed(
            "binance",
            format!("http {}", status.as_u16()),
        ));
    }

    let body: TickerResponse = match resp.json().await {
        Ok(b) => b,
        Err(e) => return Ok(VenueReading::failed("binance", format!("decode: {e}"))),
    };

    let price: f64 = match body.last_price.parse() {
        Ok(p) if p > 0.0 => p,
        Ok(_) => return Ok(VenueReading::failed("binance", "zero_price")),
        Err(e) => return Ok(VenueReading::failed("binance", format!("parse_price: {e}"))),
    };

    // Don't silently zero the depth proxy on parse failure — that gives Binance
    // zero weight in the median and can flip a clean reading into a refusal.
    let volume: f64 = match body.quote_volume.parse() {
        Ok(v) if v > 0.0 => v,
        _ => return Ok(VenueReading::failed("binance", "bad_volume")),
    };

    // close_time is in milliseconds.
    let timestamp = body.close_time / 1000;

    Ok(VenueReading::ok("binance", price, volume, timestamp))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_ticker_response() {
        let raw = r#"{
            "symbol": "ETHUSDT",
            "lastPrice": "3500.50",
            "quoteVolume": "1500000000.0",
            "closeTime": 1714521600000
        }"#;
        let parsed: TickerResponse = serde_json::from_str(raw).unwrap();
        assert_eq!(parsed.last_price, "3500.50");
        assert_eq!(parsed.close_time, 1714521600000);
    }
}
