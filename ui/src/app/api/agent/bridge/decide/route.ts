import { NextRequest, NextResponse } from "next/server";
import { decideBridgeStream, BridgeDecideInput } from "@/lib/bridge-llm";
import { commitBridgeVerdict } from "@/lib/agent-onchain/bridge";
import { streamWithCommit } from "@/lib/agent-onchain/stream-commit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

interface BridgeFinal {
  decision: "ALLOW" | "REFUSE";
  reason: string;
  reasoning: string;
}

export async function POST(req: NextRequest) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY not configured on the server" },
      { status: 503 },
    );
  }

  let input: BridgeDecideInput;
  try {
    input = (await req.json()) as BridgeDecideInput;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!input.state || !input.action || typeof input.amountUsd !== "number") {
    return NextResponse.json(
      { error: "missing state / action / amountUsd" },
      { status: 400 },
    );
  }
  if (input.action !== "WITHDRAW") {
    return NextResponse.json({ error: "action must be WITHDRAW" }, { status: 400 });
  }

  // Stable per-scenario key so identical scenarios get the same on-chain
  // attestation root. Hash of the bridge state's distinguishing fields.
  const scenarioKey = `bridge:${input.state.sourceHeight}:${input.state.finalizedHeight}:${input.state.validatorsSigning}/${input.state.validatorsTotal}:${input.state.attestationAgeSec}:${input.amountUsd}`;

  const stream = streamWithCommit({
    stream: decideBridgeStream(input),
    pickFinal: (event) =>
      event.type === "final" ? (event.output as BridgeFinal) : null,
    commit: async (final) =>
      commitBridgeVerdict({
        scenarioKey,
        decision: final.decision,
        blob: {
          schema: "bridge-guardian/v1",
          chain: "base-sepolia",
          scenarioKey,
          input,
          verdict: final,
          committedAt: new Date().toISOString(),
        },
      }),
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
