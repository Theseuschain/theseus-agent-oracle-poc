import { ADDRESSES, FEED_ABI, publicClient } from "./chain";
import { FeedSnapshot, Decision } from "./types";

const DECISION_NAME: Record<number, Decision> = {
  0: "UNINITIALIZED",
  1: "PRICED",
  2: "REFUSED",
};

/**
 * Read the latest round from AgentPriceFeed. Returns null when the feed
 * address isn't configured yet (pre-deploy state).
 */
export async function readFeed(): Promise<FeedSnapshot | null> {
  if (!ADDRESSES.feed) return null;

  const [latestRoundId, blockNumber] = await Promise.all([
    publicClient.readContract({
      address: ADDRESSES.feed,
      abi: FEED_ABI,
      functionName: "latestRoundId",
    }) as Promise<bigint>,
    publicClient.getBlockNumber(),
  ]);

  if (latestRoundId === 0n) {
    return {
      decision: "UNINITIALIZED",
      priceUsd: 0,
      updatedAt: 0,
      block: Number(blockNumber),
      reasonHash: "0x".padEnd(66, "0"),
      ageSeconds: 0,
    };
  }

  const round = (await publicClient.readContract({
    address: ADDRESSES.feed,
    abi: FEED_ABI,
    functionName: "rounds",
    args: [latestRoundId],
  })) as readonly [bigint, bigint, bigint, number, `0x${string}`];

  const [answer, _started, updatedAt, decision, reasonHash] = round;
  const now = Math.floor(Date.now() / 1000);

  return {
    decision: DECISION_NAME[Number(decision)] ?? "UNINITIALIZED",
    priceUsd: Number(answer) / 1e8,
    updatedAt: Number(updatedAt),
    block: Number(blockNumber),
    reasonHash,
    ageSeconds: Math.max(0, now - Number(updatedAt)),
  };
}
