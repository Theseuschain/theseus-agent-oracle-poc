/**
 * Single source of truth for Theseus deployment addresses + endpoints.
 *
 * Reads from process.env. NEXT_PUBLIC_* vars are bundled to the browser
 * (used by viem clients in client components). Plain vars stay server-side
 * (used by the substrate client in API routes).
 *
 * Conventions match the Theseus example repos (proof-of-lobster,
 * the-prediction-market): substrate WS at 9944, EVM RPC at 9933, agent
 * deployed via `theseus-cli deploy-agent`, addresses persisted to
 * contracts/deployments/*.txt.
 */

export interface BrowserConfig {
  evmRpc: string;
  chainId: number;
  // EVM-side contract addresses. All optional; when missing, the UI
  // falls back to mock mode.
  agentPriceFeed?: `0x${string}`;
  pool?: `0x${string}`;
  weth?: `0x${string}`;
  usdc?: `0x${string}`;
  agentEvmAddress?: `0x${string}`;
  // SHIP agent's substrate AccountId (ss58 or 0x-hex). Used by the UI
  // to display "your agent: SUI…JzM" and by the server to route tampers.
  agentId?: string;
  walletConnectProjectId?: string;
}

export interface ServerConfig extends BrowserConfig {
  substrateWs: string;
  // sr25519 seed/URI for the admin signer that submits tamper / reset
  // extrinsics. Defaults to //Alice in dev. **Mark as Sensitive on Vercel.**
  adminSeed: string;
}

const browserDefaults = {
  // Theseus exposes Ethereum-compatible JSON-RPC via the `eth-rpc` proxy
  // (PolkaVM / pallet-revive backend). Match the lz-local convention from
  // github.com/Theseuschain/theseus-layerzero-evm.
  evmRpc: "http://127.0.0.1:8545",
  chainId: 420_420_420, // Theseus devnet; overridden via NEXT_PUBLIC_CHAIN_ID
} as const;

const serverDefaults = {
  ...browserDefaults,
  substrateWs: "ws://127.0.0.1:9944",
  adminSeed: "//Alice",
} as const;

const opt = (v: string | undefined): `0x${string}` | undefined =>
  v && v.startsWith("0x") ? (v as `0x${string}`) : undefined;

/** Browser-safe slice of the config. Reads only NEXT_PUBLIC_* vars. */
export function getBrowserConfig(): BrowserConfig {
  return {
    evmRpc: process.env.NEXT_PUBLIC_EVM_RPC ?? browserDefaults.evmRpc,
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? browserDefaults.chainId),
    agentPriceFeed: opt(process.env.NEXT_PUBLIC_AGENT_PRICE_FEED),
    pool: opt(process.env.NEXT_PUBLIC_POOL),
    weth: opt(process.env.NEXT_PUBLIC_WETH),
    usdc: opt(process.env.NEXT_PUBLIC_USDC),
    agentEvmAddress: opt(process.env.NEXT_PUBLIC_AGENT_EVM_ADDRESS),
    agentId: process.env.NEXT_PUBLIC_AGENT_ID || undefined,
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || undefined,
  };
}

/** Server-side config. Includes the admin seed; never import from a
 *  client component. */
export function getServerConfig(): ServerConfig {
  return {
    ...getBrowserConfig(),
    substrateWs: process.env.THESEUS_WS ?? serverDefaults.substrateWs,
    adminSeed: process.env.ADMIN_SEED ?? serverDefaults.adminSeed,
  };
}

/** True when enough deployment artifacts are present to flip from
 *  mock to live mode. AgentPriceFeed is the linchpin; without its
 *  address the feed panel has nothing to read. */
export function hasLiveDeployment(cfg: BrowserConfig): boolean {
  return !!cfg.agentPriceFeed;
}
