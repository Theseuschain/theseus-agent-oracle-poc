import { NextResponse } from "next/server";
import { runOneTick } from "@/lib/launch-sniper/loop";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

function envReady(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!process.env.AGENT_PRIVATE_KEY) missing.push("AGENT_PRIVATE_KEY");
  return { ok: missing.length === 0, missing };
}

async function handle() {
  const env = envReady();
  if (!env.ok) {
    return NextResponse.json(
      { status: "error", error: `missing env: ${env.missing.join(", ")}` },
      { status: 503 },
    );
  }

  try {
    const outcome = await runOneTick();
    return NextResponse.json(outcome, {
      status: outcome.status === "error" ? 500 : 200,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: (err as Error).message },
      { status: 500 },
    );
  }
}

export const POST = handle;
// Allow GET so Vercel cron (which sends GET) can trigger it without a
// custom body.
export const GET = handle;
