/**
 * Uniswap V3 reader.
 *
 * Tries the TWAP path first (observe over a 30-min window) and falls back to
 * slot0 (instant tick) when the public RPC can't serve historical state.
 * Either way, returns ETH/USD computed from the WETH/USDC 0.05% pool on
 * Ethereum mainnet.
 */

import { Address, createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { VenueReading } from "../types";
import { failed, ok } from "./types";

const POOL_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
]);

const ERC20_MIN = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

// WETH/USDC 0.05% pool. token0 = USDC (6 dec), token1 = WETH (18 dec).
const ETH_USDC_POOL = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640" as Address;
const TWAP_WINDOWS_TO_TRY = [1800, 600, 60]; // 30m → 10m → 1m
const TIMEOUT_MS = 6_000;

// Public no-key Ethereum RPCs ordered by observed reliability for this
// workload (eth_call against a Uniswap V3 pool). Override via MAINNET_RPC
// (e.g. to plug in an Alchemy / Infura key with full historical state) for
// the most consistent TWAP path.
const RPCS = [
  process.env.MAINNET_RPC,
  "https://eth-mainnet.public.blastapi.io",
  "https://rpc.ankr.com/eth",
  "https://cloudflare-eth.com",
  "https://eth.llamarpc.com",
].filter((u): u is string => !!u);

type ViemClient = ReturnType<typeof createPublicClient>;

export async function uniswapTwap(): Promise<VenueReading> {
  if (RPCS.length === 0) return failed("uniswap", "no_rpc_configured");

  let lastError = "no_rpc_responded";

  for (const rpc of RPCS) {
    try {
      const client = createPublicClient({
        chain: mainnet,
        transport: http(rpc, { timeout: TIMEOUT_MS, retryCount: 0 }),
      });

      const [token0, token1] = (await Promise.all([
        client.readContract({ address: ETH_USDC_POOL, abi: POOL_ABI, functionName: "token0" }),
        client.readContract({ address: ETH_USDC_POOL, abi: POOL_ABI, functionName: "token1" }),
      ])) as [Address, Address];

      const [dec0, dec1] = (await Promise.all([
        client.readContract({ address: token0, abi: ERC20_MIN, functionName: "decimals" }),
        client.readContract({ address: token1, abi: ERC20_MIN, functionName: "decimals" }),
      ])) as [number, number];

      const tick = await readTick(client);
      if (tick === null) {
        lastError = "all_paths_failed";
        continue;
      }

      const ratioRaw = Math.pow(1.0001, tick);
      const decAdj = Math.pow(10, dec0 - dec1);
      const humanRatio = ratioRaw * decAdj;

      // For the WETH/USDC pool: dec0 (USDC) < dec1 (WETH), so invert to get
      // USD per ETH. For an ETH/<stable> pool with the inverse orientation,
      // the same heuristic works.
      const priceUsd = dec0 < dec1 ? 1 / humanRatio : humanRatio;

      const [bal0, bal1] = (await Promise.all([
        client.readContract({ address: token0, abi: ERC20_MIN, functionName: "balanceOf", args: [ETH_USDC_POOL] }),
        client.readContract({ address: token1, abi: ERC20_MIN, functionName: "balanceOf", args: [ETH_USDC_POOL] }),
      ])) as [bigint, bigint];

      const bal0Human = u256ToFloat(bal0, dec0);
      const bal1Human = u256ToFloat(bal1, dec1);

      const tvlUsd =
        dec0 < dec1
          ? bal0Human + bal1Human * priceUsd
          : bal1Human + bal0Human * priceUsd;

      return ok("uniswap", priceUsd, tvlUsd);
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message.split("\n")[0] : String(e);
    }
  }
  return failed("uniswap", lastError);
}

/** Try TWAPs at progressively shorter windows, then fall back to slot0. */
async function readTick(client: ViemClient): Promise<number | null> {
  for (const w of TWAP_WINDOWS_TO_TRY) {
    try {
      const result = (await client.readContract({
        address: ETH_USDC_POOL,
        abi: POOL_ABI,
        functionName: "observe",
        args: [[w, 0]],
      })) as readonly [readonly bigint[], readonly bigint[]];
      const cumulatives = result[0];
      if (cumulatives.length === 2) {
        const tickDiff = Number(cumulatives[1] - cumulatives[0]);
        return tickDiff / w;
      }
    } catch {
      // try next window
    }
  }
  // Fall back: instant tick from slot0.
  try {
    const result = (await client.readContract({
      address: ETH_USDC_POOL,
      abi: POOL_ABI,
      functionName: "slot0",
    })) as readonly [bigint, number, number, number, number, number, boolean];
    return Number(result[1]); // current tick
  } catch {
    return null;
  }
}

function u256ToFloat(v: bigint, decimals: number): number {
  if (v <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(v) / Math.pow(10, decimals);
  }
  const divisor = BigInt(10) ** BigInt(decimals);
  const scaled = v / divisor;
  return scaled <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(scaled) : Number.MAX_VALUE;
}
