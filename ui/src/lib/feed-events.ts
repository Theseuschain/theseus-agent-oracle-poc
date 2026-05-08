/**
 * Build the live-mode timeline by reading AgentPriceFeed's emitted events
 * (PriceUpdated, Refused). Each event contributes one TimelineEntry.
 *
 * The reasoning blob isn't on-chain. Only its keccak256 hash is anchored
 * (in the Refused event). The full reasoning lives in TensorCommit; fetching
 * it requires a Theseus runtime API that doesn't exist yet, so the live
 * timeline shows the structural decision and hash, with a "reasoning blob
 * stored off-chain (TensorCommit)" placeholder where the paragraph would go.
 */

import { ADDRESSES, FEED_ABI, publicClient } from "./chain";
import { TimelineEntry } from "./types";

const LOOKBACK_BLOCKS = 5_000n; // ~8h at 6s/block, plenty for a demo

export async function readTimelineFromEvents(): Promise<TimelineEntry[]> {
  if (!ADDRESSES.feed) return [];

  const head = await publicClient.getBlockNumber();
  const from = head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n;

  const [pricedLogs, refusedLogs] = await Promise.all([
    publicClient.getContractEvents({
      address: ADDRESSES.feed,
      abi: FEED_ABI,
      eventName: "PriceUpdated",
      fromBlock: from,
      toBlock: head,
    }),
    publicClient.getContractEvents({
      address: ADDRESSES.feed,
      abi: FEED_ABI,
      eventName: "Refused",
      fromBlock: from,
      toBlock: head,
    }),
  ]);

  const entries: TimelineEntry[] = [];

  for (const log of pricedLogs) {
    const args = log.args as { roundId?: bigint; answer?: bigint; updatedAt?: bigint };
    if (args.answer === undefined) continue;
    entries.push({
      block: Number(log.blockNumber ?? 0n),
      decision: "PRICED",
      priceUsd: Number(args.answer) / 1e8,
      reasoning:
        "Reasoning committed via TensorCommit. Fetch the matching blob from the agent's commitment store to see the full chain-of-thought.",
    });
  }

  for (const log of refusedLogs) {
    const args = log.args as { roundId?: bigint; updatedAt?: bigint; reasonHash?: `0x${string}` };
    entries.push({
      block: Number(log.blockNumber ?? 0n),
      decision: "REFUSED",
      reason: "see reasonHash for off-chain reasoning",
      reasonHash: args.reasonHash,
      reasoning:
        "Reasoning committed via TensorCommit at this block. The on-chain reasonHash anchors the off-chain blob.",
    });
  }

  // Newest first.
  return entries.sort((a, b) => b.block - a.block).slice(0, 20);
}
