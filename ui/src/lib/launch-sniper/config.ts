/**
 * Launch sniper configuration.
 *
 * The agent reads Base mainnet for new Uniswap V3 pools and posts paper
 * trades to a Base Sepolia LaunchSniperFund contract. Two chains, two
 * RPCs, one wallet (the agent EOA).
 */

export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/** Base mainnet Uniswap V3 factory. Emits PoolCreated. */
export const UNISWAP_V3_FACTORY_MAINNET =
  "0x33128a8fC17869897dcE68Ed026d694621f6FDfD" as const;

/** Base mainnet quote tokens. We only evaluate pools where one side is
 *  USDC or WETH; pools between two long-tail tokens are noise. */
export const USDC_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const WETH_MAINNET = "0x4200000000000000000000000000000000000006" as const;

/** Base Sepolia LaunchSniperFund commitment surface (deployed
 *  2026-05-11). The agent writes paper-trade ticks here. */
export const LAUNCH_SNIPER_FUND_SEPOLIA =
  "0xa6fbaadea4e7f58d812d989737d708b279e8bd21" as const;

/** Public RPCs. The env-overridable values are the production path; the
 *  defaults keep the demo working without credentials. */
export const BASE_MAINNET_RPC =
  process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
export const BASE_SEPOLIA_RPC =
  process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";

/** Pool fee tiers the indexer scans. 0.05% and 0.3% capture the vast
 *  majority of fresh launches; 1% is also common for very-low-liquidity
 *  long-tail tokens. */
export const POOL_FEE_TIERS = [500, 3000, 10000] as const;

/** How far back the indexer looks each tick. Base mainnet blocks are
 *  ~2s, so 1800 blocks ≈ 1 hour. Keep this small to stay within free
 *  RPC eth_getLogs windows (most public RPCs cap around 10k blocks). */
export const INDEXER_LOOKBACK_BLOCKS = 1800;

/** Max number of fresh-pool candidates the indexer surfaces per tick.
 *  Keeps a single tick from doing too much work. */
export const INDEXER_MAX_CANDIDATES = 20;

/** Anthropic model for the cheap first-pass evaluation. */
export const EVAL_MODEL_CHEAP = "claude-haiku-4-5";

/** Anthropic model for escalation when the cheap pass says "interesting".
 *  Not used in Phase 1; placeholder for Phase 2. */
export const EVAL_MODEL_RIGOROUS = "claude-sonnet-4-6";
