import { NextResponse } from "next/server";
import { readFundLiveState } from "@/lib/agent-onchain/fund-reader";

export const dynamic = "force-dynamic";
export const revalidate = 30;
export const runtime = "nodejs";

export async function GET() {
  try {
    const state = await readFundLiveState();
    return NextResponse.json(
      {
        ...state,
        usdcBalance: state.usdcBalance.toString(),
        wethBalance: state.wethBalance.toString(),
        recentTicks: state.recentTicks.map((t) => ({
          ...t,
          amountIn: t.amountIn.toString(),
          amountOut: t.amountOut.toString(),
          usdcAfter: t.usdcAfter.toString(),
          wethAfter: t.wethAfter.toString(),
          timestamp: t.timestamp.toString(),
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
