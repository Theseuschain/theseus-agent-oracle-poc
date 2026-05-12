/**
 * Read-side helpers for the LaunchSniperFund contract.
 *
 * The viewer (server component) calls into these to compose the fund's
 * current state: paper USDC, open positions, full tick history. Each
 * tick is enriched with the reasoning-blob URL (deterministic from the
 * on-chain reasonHash) so the UI can deep-link to the full dossier.
 */

import {
  createPublicClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { LAUNCH_SNIPER_FUND_ABI } from "./abi";
import { blobPublicUrl } from "./blob-store";
import {
  BASE_SEPOLIA_RPC,
  LAUNCH_SNIPER_FUND_SEPOLIA,
} from "./config";

export interface TickRow {
  index: number;
  action: "HOLD" | "PASS" | "BUY_TOKEN" | "SELL_TOKEN";
  token: Address;
  amountToken: bigint;
  amountUsdc: bigint;
  paperUsdcAfter: bigint;
  reasonHash: Hex;
  timestamp: bigint;
  /** Computed URL for the reasoning blob (null if Blob storage not
   *  configured at write-time). */
  blobUrl: string | null;
}

export interface PositionRow {
  token: Address;
  amount: bigint;
  costBasisUsdc: bigint;
  proceedsUsdc: bigint;
  open: boolean;
}

export interface FundState {
  paperUsdc: bigint;
  startingUsdc: bigint;
  tickCount: number;
  tokenCount: number;
  positions: PositionRow[];
  ticks: TickRow[];
}

const ACTION_LABEL: TickRow["action"][] = [
  "HOLD",
  "PASS",
  "BUY_TOKEN",
  "SELL_TOKEN",
];

function getClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });
}

/** Reads every tick. The contract has an auto-generated `ticks(uint256)`
 *  getter that returns the struct as a tuple; viem decodes it for us. */
async function readAllTicks(count: number): Promise<TickRow[]> {
  if (count === 0) return [];
  const client = getClient();
  const calls = Array.from({ length: count }, (_, i) => ({
    address: LAUNCH_SNIPER_FUND_SEPOLIA,
    abi: LAUNCH_SNIPER_FUND_ABI,
    functionName: "ticks" as const,
    args: [BigInt(i)] as const,
  }));
  const results = await client.multicall({ contracts: calls });
  const out: TickRow[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== "success") continue;
    const tuple = r.result as unknown as readonly [
      number,
      Address,
      bigint,
      bigint,
      bigint,
      Hex,
      bigint,
    ];
    const [actionIdx, token, amountToken, amountUsdc, paperUsdcAfter, reasonHash, timestamp] = tuple;
    out.push({
      index: i,
      action: ACTION_LABEL[actionIdx] ?? "HOLD",
      token,
      amountToken,
      amountUsdc,
      paperUsdcAfter,
      reasonHash,
      timestamp,
      blobUrl: blobPublicUrl(reasonHash),
    });
  }
  return out;
}

async function readAllPositions(tokens: Address[]): Promise<PositionRow[]> {
  if (tokens.length === 0) return [];
  const client = getClient();
  const calls = tokens.map((t) => ({
    address: LAUNCH_SNIPER_FUND_SEPOLIA,
    abi: LAUNCH_SNIPER_FUND_ABI,
    functionName: "positions" as const,
    args: [t] as const,
  }));
  const results = await client.multicall({ contracts: calls });
  const out: PositionRow[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const r = results[i];
    if (r.status !== "success") continue;
    const tuple = r.result as unknown as readonly [bigint, bigint, bigint, boolean];
    const [amount, costBasisUsdc, proceedsUsdc, open] = tuple;
    out.push({
      token: tokens[i],
      amount,
      costBasisUsdc,
      proceedsUsdc,
      open,
    });
  }
  return out;
}

async function readAllTokens(tokenCount: number): Promise<Address[]> {
  if (tokenCount === 0) return [];
  const client = getClient();
  const calls = Array.from({ length: tokenCount }, (_, i) => ({
    address: LAUNCH_SNIPER_FUND_SEPOLIA,
    abi: LAUNCH_SNIPER_FUND_ABI,
    functionName: "tokens" as const,
    args: [BigInt(i)] as const,
  }));
  const results = await client.multicall({ contracts: calls });
  return results
    .map((r) => (r.status === "success" ? (r.result as Address) : null))
    .filter((x): x is Address => x !== null);
}

export async function readFundState(): Promise<FundState> {
  const client = getClient();
  // Read the cheap stuff first; if any of these fail the page should
  // still render the failure state.
  const [paperUsdc, startingUsdc, tickCount, tokenCount] = await Promise.all([
    client.readContract({
      address: LAUNCH_SNIPER_FUND_SEPOLIA,
      abi: LAUNCH_SNIPER_FUND_ABI,
      functionName: "paperUsdc",
    }) as Promise<bigint>,
    client.readContract({
      address: LAUNCH_SNIPER_FUND_SEPOLIA,
      abi: LAUNCH_SNIPER_FUND_ABI,
      functionName: "startingUsdc",
    }) as Promise<bigint>,
    client.readContract({
      address: LAUNCH_SNIPER_FUND_SEPOLIA,
      abi: LAUNCH_SNIPER_FUND_ABI,
      functionName: "tickCount",
    }) as Promise<bigint>,
    client.readContract({
      address: LAUNCH_SNIPER_FUND_SEPOLIA,
      abi: LAUNCH_SNIPER_FUND_ABI,
      functionName: "tokenCount",
    }) as Promise<bigint>,
  ]);

  const tokens = await readAllTokens(Number(tokenCount));
  const [positions, ticks] = await Promise.all([
    readAllPositions(tokens),
    readAllTicks(Number(tickCount)),
  ]);

  // Newest-first
  ticks.sort((a, b) => b.index - a.index);

  return {
    paperUsdc,
    startingUsdc,
    tickCount: Number(tickCount),
    tokenCount: Number(tokenCount),
    positions,
    ticks,
  };
}
