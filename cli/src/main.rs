use anyhow::Result;
use clap::{Parser, Subcommand};

mod aave;
mod agent;
mod config;

use config::Config;

#[derive(Parser)]
#[command(name = "op", about = "Theseus Agent Oracle CLI")]
struct Cli {
    /// Path to deployments dir (defaults to ../contracts/deployments).
    #[arg(long, global = true)]
    deployments: Option<String>,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Deposit WETH as collateral into the Aave pool.
    Deposit {
        /// Amount in ETH (e.g. "1.5").
        amount: String,
    },

    /// Borrow USDC against existing collateral.
    Borrow {
        /// Amount in USDC (e.g. "1500").
        amount: String,
    },

    /// Repay outstanding USDC debt.
    Repay {
        /// Amount in USDC. Use "max" to repay all.
        amount: String,
    },

    /// Withdraw WETH collateral.
    Withdraw {
        amount: String,
    },

    /// Attempt to liquidate a user's position.
    Liquidate {
        /// Substrate or EVM address of the user being liquidated.
        user: String,
        /// Debt asset ("USDC").
        debt_asset: String,
        /// Amount of debt to cover.
        amount: String,
    },

    /// Tamper with one of the agent's venue readings (demo only).
    /// This swaps the live tool implementation for a manipulated stub
    /// for the next N agent runs.
    Tamper {
        /// Which venue to manipulate.
        #[arg(value_parser = ["coinbase", "binance", "uniswap"])]
        venue: String,

        /// Override price (e.g. "100000" for $100k ETH).
        #[arg(long)]
        price: f64,

        /// Number of upcoming agent runs to keep the override active.
        #[arg(long, default_value_t = 1)]
        runs: u32,
    },

    /// Stop tampering, restore live venue tools.
    Reset,

    /// Print current state: agent decision, latest price, user position.
    Status,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let cfg = Config::load(cli.deployments.as_deref())?;

    match cli.command {
        Command::Deposit { amount } => aave::deposit(&cfg, &amount).await?,
        Command::Borrow { amount } => aave::borrow(&cfg, &amount).await?,
        Command::Repay { amount } => aave::repay(&cfg, &amount).await?,
        Command::Withdraw { amount } => aave::withdraw(&cfg, &amount).await?,
        Command::Liquidate { user, debt_asset, amount } => {
            aave::liquidate(&cfg, &user, &debt_asset, &amount).await?
        }
        Command::Tamper { venue, price, runs } => {
            agent::tamper(&cfg, &venue, price, runs).await?
        }
        Command::Reset => agent::reset(&cfg).await?,
        Command::Status => status(&cfg).await?,
    }

    Ok(())
}

async fn status(cfg: &Config) -> Result<()> {
    use owo_colors::OwoColorize;

    let feed = aave::feed_status(cfg).await?;
    let position = aave::user_position(cfg).await?;
    let agent_state = agent::status(cfg).await?;

    println!("{}", "Agent Price Feed".bold());
    println!("  decision      : {}", match feed.decision.as_str() {
        "PRICED"   => format!("{}", feed.decision.green()),
        "REFUSED"  => format!("{}", feed.decision.red()),
        _          => format!("{}", feed.decision.yellow()),
    });
    println!("  price         : ${:.2}", feed.price_usd);
    println!("  last update   : {} ({}s ago)", feed.updated_at_iso, feed.age_seconds);
    println!("  reason hash   : {}", feed.reason_hash);
    println!();

    println!("{}", "Your position".bold());
    println!("  collateral    : {} WETH (${:.2})", position.weth_collateral, position.collateral_usd);
    println!("  debt          : {} USDC (${:.2})", position.usdc_debt, position.debt_usd);
    println!("  health factor : {:.3}", position.health_factor);
    println!();

    println!("{}", "Agent state".bold());
    println!("  next run      : block {} (in ~{}s)", agent_state.next_run_block, agent_state.next_run_eta);
    println!("  tamper active : {}", if agent_state.tamper_active { "yes".red().to_string() } else { "no".to_string() });

    Ok(())
}
