import { NextRequest, NextResponse } from "next/server";
import {
  AviationReviewInput,
  reviewAviationStream,
} from "@/lib/aviation-llm";
import { commitAviationVerdict } from "@/lib/agent-onchain/aviation";
import { streamWithCommit } from "@/lib/agent-onchain/stream-commit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

interface AviationFinal {
  decision: "APPROVE" | "CAUTION" | "REJECT";
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

  let input: AviationReviewInput;
  try {
    input = (await req.json()) as AviationReviewInput;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!input.change || typeof input.change.changeId !== "number") {
    return NextResponse.json({ error: "missing change" }, { status: 400 });
  }

  const changeId = input.change.changeId;

  const stream = streamWithCommit({
    stream: reviewAviationStream(input),
    pickFinal: (event) =>
      event.type === "final" ? (event.output as AviationFinal) : null,
    commit: async (final) =>
      commitAviationVerdict({
        changeId,
        decision: final.decision,
        blob: {
          schema: "aviation-safety-reviewer/v1",
          chain: "base-sepolia",
          changeId,
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
