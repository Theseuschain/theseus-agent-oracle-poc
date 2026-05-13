/**
 * Shared wallet setup for any agent that needs to commit a verdict
 * on-chain. Mirrors the launch-sniper executor but isolated so other
 * agents can import without reaching into the sniper module.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const BASE_SEPOLIA_RPC =
  process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";

/** Returns the agent's viem account from AGENT_PRIVATE_KEY. Throws if
 *  the env var isn't set so the caller can return a 503. */
export function getAgentAccount() {
  const raw = process.env.AGENT_PRIVATE_KEY;
  if (!raw) {
    throw new Error("AGENT_PRIVATE_KEY not configured");
  }
  const hex = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  return privateKeyToAccount(hex);
}

export function getSepoliaPublic() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });
}

export function getSepoliaWallet() {
  return createWalletClient({
    account: getAgentAccount(),
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });
}

export function basescanTxUrl(hash: Hex): string {
  return `https://sepolia.basescan.org/tx/${hash}`;
}
