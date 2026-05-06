import { NextResponse } from "next/server";
import { getMockTimeline } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  // For now timeline is always mock — the agent's per-decision events live
  // off-chain in TensorCommit and aren't yet exposed via a public RPC. When
  // they are, swap this for a live read.
  return NextResponse.json({ mode: "mock", entries: getMockTimeline() });
}
