import { NextRequest, NextResponse } from "next/server";
import { getMockPosition, mockUpdatePosition } from "@/lib/mock-state";
import { ADDRESSES, POOL_ABI, publicClient } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get("user");

  if (user && ADDRESSES.pool) {
    try {
      const data = (await publicClient.readContract({
        address: ADDRESSES.pool,
        abi: POOL_ABI,
        functionName: "getUserAccountData",
        args: [user as `0x${string}`],
      })) as readonly [bigint, bigint, bigint, bigint, bigint, bigint];

      const [collateralBase, debtBase, , , ltv, healthFactor] = data;
      return NextResponse.json({
        mode: "live",
        position: {
          collateralWeth: 0, // need a separate aWETH balanceOf for this
          collateralUsd: Number(collateralBase) / 1e8,
          debtUsdc: 0,
          debtUsd: Number(debtBase) / 1e8,
          healthFactor: Number(healthFactor) / 1e18,
          ltv: Number(ltv) / 10000,
        },
      });
    } catch (e: unknown) {
      console.warn("[api/position] live read failed, using mock", e);
    }
  }

  return NextResponse.json({ mode: "mock", position: getMockPosition() });
}

interface ActionRequest {
  action: "deposit" | "borrow" | "repay" | "withdraw";
  amount: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<ActionRequest>;
  if (
    !body.action ||
    !["deposit", "borrow", "repay", "withdraw"].includes(body.action) ||
    typeof body.amount !== "number" ||
    !(body.amount > 0)
  ) {
    return NextResponse.json({ ok: false, revertReason: "invalid request" }, { status: 400 });
  }

  // The real action goes via wagmi from the browser (so the user's wallet
  // signs it). This POST is the *mock* path for screenshots and pre-deploy
  // demos. When live, the frontend skips this route and writes directly.
  mockUpdatePosition(body.action, body.amount);

  // Mock: borrow / withdraw revert when refused; deposit / repay don't.
  // (Caller is expected to know whether the feed is refused; this route
  // doesn't introspect.)
  return NextResponse.json({ ok: true });
}
