/**
 * Base mainnet Uniswap V3 PoolCreated indexer.
 *
 * Each call: query the last N blocks for PoolCreated events from the
 * canonical Uniswap V3 factory, keep only the pools paired with USDC
 * or WETH, and return them oldest-first. The caller deduplicates against
 * the LaunchSniperFund contract's `tokens` list (which records every
 * token the agent has ever evaluated).
 */

import { createPublicClient, http, parseAbiItem, type Address, type Log } from "viem";
import { base } from "viem/chains";
import {
  BASE_MAINNET_RPC,
  INDEXER_LOOKBACK_BLOCKS,
  INDEXER_MAX_CANDIDATES,
  POOL_FEE_TIERS,
  UNISWAP_V3_FACTORY_MAINNET,
  USDC_MAINNET,
  WETH_MAINNET,
} from "./config";
import type { PoolCandidate } from "./types";

const POOL_CREATED_EVENT = parseAbiItem(
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
);

export function getMainnetClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_MAINNET_RPC),
  });
}

/** Lowercase address compare; viem returns checksummed strings. */
function eqAddr(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Returns true if exactly one side of the pool is a quote (USDC/WETH). */
function classifyPair(
  token0: Address,
  token1: Address,
): { token: Address; quote: "USDC" | "WETH"; quoteAddress: Address } | null {
  const usdc0 = eqAddr(token0, USDC_MAINNET);
  const weth0 = eqAddr(token0, WETH_MAINNET);
  const usdc1 = eqAddr(token1, USDC_MAINNET);
  const weth1 = eqAddr(token1, WETH_MAINNET);

  // Skip stable/wrapped pairs (USDC/WETH itself) — not a token launch.
  if ((usdc0 || weth0) && (usdc1 || weth1)) return null;

  if (usdc0) return { token: token1, quote: "USDC", quoteAddress: USDC_MAINNET };
  if (weth0) return { token: token1, quote: "WETH", quoteAddress: WETH_MAINNET };
  if (usdc1) return { token: token0, quote: "USDC", quoteAddress: USDC_MAINNET };
  if (weth1) return { token: token0, quote: "WETH", quoteAddress: WETH_MAINNET };

  return null;
}

export async function fetchRecentCandidates(): Promise<PoolCandidate[]> {
  const client = getMainnetClient();
  const head = await client.getBlockNumber();
  const fromBlock = head - BigInt(INDEXER_LOOKBACK_BLOCKS);

  const logs = await client.getLogs({
    address: UNISWAP_V3_FACTORY_MAINNET,
    event: POOL_CREATED_EVENT,
    fromBlock,
    toBlock: head,
    args: {
      // viem accepts a bigint-or-number for a uint24 indexed filter; the
      // values here match Uniswap's fee tiers.
      fee: POOL_FEE_TIERS as unknown as number[],
    },
  });

  const candidates: PoolCandidate[] = [];
  for (const log of logs as Array<Log<bigint, number, false, typeof POOL_CREATED_EVENT>>) {
    const { token0, token1, fee, pool } = log.args as {
      token0: Address;
      token1: Address;
      fee: number;
      pool: Address;
    };
    const classified = classifyPair(token0, token1);
    if (!classified) continue;
    candidates.push({
      pool,
      token: classified.token,
      quote: classified.quote,
      quoteAddress: classified.quoteAddress,
      feeTier: fee,
      createdAtBlock: log.blockNumber!,
      txHash: log.transactionHash!,
    });
  }

  // Oldest first: FIFO so the agent doesn't strand candidates indefinitely.
  candidates.sort((a, b) =>
    a.createdAtBlock < b.createdAtBlock
      ? -1
      : a.createdAtBlock > b.createdAtBlock
        ? 1
        : 0,
  );

  return candidates.slice(0, INDEXER_MAX_CANDIDATES);
}
