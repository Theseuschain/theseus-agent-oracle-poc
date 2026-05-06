import { NextRequest, NextResponse } from "next/server";
import { mockTamper } from "@/lib/mock-state";
import { TamperRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<TamperRequest>;
  if (
    !body.venue ||
    !["coinbase", "binance", "uniswap"].includes(body.venue) ||
    typeof body.priceUsd !== "number" ||
    !(body.priceUsd > 0)
  ) {
    return NextResponse.json({ error: "invalid tamper request" }, { status: 400 });
  }

  const runs = body.runs ?? 1;

  // Live mode: route through substrate. We import lazily so production builds
  // without an active chain don't crash the bundle.
  if (process.env.NEXT_PUBLIC_AGENT_ID && process.env.THESEUS_WS) {
    try {
      const { tamper } = await import("@/lib/substrate");
      const result = await tamper({ venue: body.venue, priceUsd: body.priceUsd, runs });
      return NextResponse.json({ mode: "live", ...result });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("[api/tamper] live submit failed, falling back to mock", message);
    }
  }

  mockTamper(body.venue, body.priceUsd);
  return NextResponse.json({ mode: "mock", ok: true });
}
