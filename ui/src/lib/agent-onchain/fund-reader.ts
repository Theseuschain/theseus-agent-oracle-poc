/**
 * Read-side helpers for the deployed SovereignFund contract on Base
 * Sepolia. Powers the "live deployment" panel on the /fund demo page,
 * which shows real chain balances + tick history alongside the mocked
 * scenario controls above.
 */

import {
  createPublicClient,
  erc20Abi,
  http,
  type Address,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { DEPLOYED_CONTRACTS } from "../deployed-contracts";

const BASE_SEPOLIA_RPC =
  process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";

const FUND_ABI = [
  {
    type: "function",
    name: "usdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "weth",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "tickCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "ticks",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [
      { name: "action", type: "uint8" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOut", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "usdcAfter", type: "uint256" },
      { name: "wethAfter", type: "uint256" },
      { name: "reasonHash", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
    ],
  },
] as const;

const ACTION_LABEL: Array<"HOLD" | "BUY_WETH" | "SELL_WETH"> = [
  "HOLD",
  "BUY_WETH",
  "SELL_WETH",
];

export interface FundTickRow {
  index: number;
  action: "HOLD" | "BUY_WETH" | "SELL_WETH";
  amountIn: bigint;
  amountOut: bigint;
  usdcAfter: bigint;
  wethAfter: bigint;
  reasonHash: Hex;
  timestamp: bigint;
}

export interface FundLiveState {
  address: Address;
  usdcAddress: Address;
  wethAddress: Address;
  usdcBalance: bigint;
  wethBalance: bigint;
  tickCount: number;
  recentTicks: FundTickRow[];
}

function getClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });
}

export async function readFundLiveState(): Promise<FundLiveState> {
  const client = getClient();
  const fundAddress = DEPLOYED_CONTRACTS.sovereignFund.address as Address;

  // Read constants first so we can balance-check the tokens this fund holds.
  const [usdcAddress, wethAddress, tickCountBig] = await Promise.all([
    client.readContract({
      address: fundAddress,
      abi: FUND_ABI,
      functionName: "usdc",
    }) as Promise<Address>,
    client.readContract({
      address: fundAddress,
      abi: FUND_ABI,
      functionName: "weth",
    }) as Promise<Address>,
    client.readContract({
      address: fundAddress,
      abi: FUND_ABI,
      functionName: "tickCount",
    }) as Promise<bigint>,
  ]);

  const [usdcBalance, wethBalance] = await Promise.all([
    client.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [fundAddress],
    }) as Promise<bigint>,
    client.readContract({
      address: wethAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [fundAddress],
    }) as Promise<bigint>,
  ]);

  const tickCount = Number(tickCountBig);
  // Read last 5 ticks newest-first. If there are fewer than 5, read all.
  const N = Math.min(5, tickCount);
  const indices = Array.from({ length: N }, (_, i) => tickCount - 1 - i);

  let recentTicks: FundTickRow[] = [];
  if (N > 0) {
    const calls = indices.map((i) => ({
      address: fundAddress,
      abi: FUND_ABI,
      functionName: "ticks" as const,
      args: [BigInt(i)] as const,
    }));
    const results = await client.multicall({ contracts: calls });
    recentTicks = results
      .map((r, i) => {
        if (r.status !== "success") return null;
        const tuple = r.result as unknown as readonly [
          number,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          Hex,
          bigint,
        ];
        const [actionIdx, amountIn, amountOut, , usdcAfter, wethAfter, reasonHash, timestamp] =
          tuple;
        return {
          index: indices[i],
          action: ACTION_LABEL[actionIdx] ?? "HOLD",
          amountIn,
          amountOut,
          usdcAfter,
          wethAfter,
          reasonHash,
          timestamp,
        };
      })
      .filter((x): x is FundTickRow => x !== null);
  }

  return {
    address: fundAddress,
    usdcAddress,
    wethAddress,
    usdcBalance,
    wethBalance,
    tickCount,
    recentTicks,
  };
}
