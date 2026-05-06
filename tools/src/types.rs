use serde::{Deserialize, Serialize};

/// Result of reading a single price venue. Mirrors the `VenueReading` struct
/// declared in `agents/price_oracle.ship` — the field names must stay aligned
/// so the SHIP runtime can deserialize directly into the agent's view.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VenueReading {
    pub venue: String,
    pub price_usd: f64,
    /// $ liquidity within 50bps of mid (both sides). For venues that don't
    /// expose an order book, a 24h volume / TVL proxy is acceptable.
    pub depth_usd: f64,
    pub timestamp: u64,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl VenueReading {
    pub fn ok(venue: &str, price_usd: f64, depth_usd: f64, timestamp: u64) -> Self {
        Self {
            venue: venue.to_string(),
            price_usd,
            depth_usd,
            timestamp,
            ok: true,
            error: None,
        }
    }

    pub fn failed(venue: &str, error: impl Into<String>) -> Self {
        Self {
            venue: venue.to_string(),
            price_usd: 0.0,
            depth_usd: 0.0,
            timestamp: now_seconds(),
            ok: false,
            error: Some(error.into()),
        }
    }
}

pub(crate) fn now_seconds() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
