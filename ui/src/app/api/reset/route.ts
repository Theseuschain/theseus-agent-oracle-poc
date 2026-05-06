import { NextResponse } from "next/server";
import { mockReset } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NEXT_PUBLIC_AGENT_ID && process.env.THESEUS_WS) {
    try {
      const { reset } = await import("@/lib/substrate");
      const result = await reset();
      return NextResponse.json({ mode: "live", ...result });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("[api/reset] live submit failed, falling back to mock", message);
    }
  }

  mockReset();
  return NextResponse.json({ mode: "mock", ok: true });
}
