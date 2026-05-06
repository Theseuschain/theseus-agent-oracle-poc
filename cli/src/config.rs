use anyhow::{Context, Result};
use std::path::PathBuf;

/// Runtime addresses + endpoints. Read from the deployments/ directory that
/// scripts/deploy.sh writes to, plus environment variables for endpoints.
pub struct Config {
    pub evm_rpc: String,
    pub substrate_ws: String,
    pub private_key: String,

    pub pool_addresses_provider: String,
    pub pool: String,
    pub aave_oracle: String,
    pub agent_price_feed: String,

    pub weth: String,
    pub usdc: String,

    pub agent_id: String,
}

impl Config {
    pub fn load(deployments_dir: Option<&str>) -> Result<Self> {
        let dir = deployments_dir
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                let mut p = std::env::current_dir().expect("cwd");
                p.push("contracts");
                p.push("deployments");
                p
            });

        let read_addr = |name: &str| -> Result<String> {
            let path = dir.join(name);
            std::fs::read_to_string(&path)
                .with_context(|| format!("missing deployment file: {}", path.display()))
                .map(|s| s.trim().to_string())
        };

        let env = |key: &str| -> Result<String> {
            std::env::var(key).with_context(|| format!("env var not set: {}", key))
        };

        Ok(Config {
            evm_rpc: env("THESEUS_EVM_RPC")
                .unwrap_or_else(|_| "http://127.0.0.1:9933".to_string()),
            substrate_ws: env("THESEUS_WS")
                .unwrap_or_else(|_| "ws://127.0.0.1:9944".to_string()),
            private_key: env("OP_PRIVATE_KEY")?,

            pool_addresses_provider: read_addr("PoolAddressesProvider.txt")?,
            pool: read_addr("Pool.txt")?,
            aave_oracle: read_addr("AaveOracle.txt")?,
            agent_price_feed: read_addr("AgentPriceFeed.txt")?,

            weth: read_addr("WETH.txt")?,
            usdc: read_addr("USDC.txt")?,

            agent_id: read_addr("AgentId.txt")?,
        })
    }
}
