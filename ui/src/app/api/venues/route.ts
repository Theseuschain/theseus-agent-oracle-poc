import { NextResponse } from "next/server";
import { coinbaseOrderbook } from "@/lib/venues/coinbase";
import { binanceTicker } from "@/lib/venues/binance";
import { uniswapTwap } from "@/lib/venues/uniswap";

export const dynamic = "force-dynamic";
// Cap how often Vercel re-runs this. The exchanges' free tiers are tolerant
// at 15s intervals; a tighter cadence wouldn't tell us anything new (TWAPs
// don't move that fast) and risks rate-limiting.
export const revalidate = 15;

export async function GET() {
  const [coinbase, binance, uniswap] = await Promise.all([
    coinbaseOrderbook("ETH-USD"),
    binanceTicker("ETHUSDT"),
    uniswapTwap(),
  ]);
  return NextResponse.json(
    { venues: [coinbase, binance, uniswap], fetchedAt: Date.now() },
    {
      // Edge-cache for 10s (allow 5s of staleness while the next poll runs).
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" },
    },
  );
}
