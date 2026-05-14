import { NextRequest, NextResponse } from "next/server";
import {
  GovernanceReviewInput,
  reviewGovernanceStream,
} from "@/lib/governance-llm";
import { commitGovernanceVerdict } from "@/lib/agent-onchain/governance";
import { streamWithCommit } from "@/lib/agent-onchain/stream-commit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

interface GovernanceFinal {
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

  let input: GovernanceReviewInput;
  try {
    input = (await req.json()) as GovernanceReviewInput;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!input.proposal || typeof input.proposal.proposalId !== "number") {
    return NextResponse.json({ error: "missing proposal" }, { status: 400 });
  }

  const proposalId = input.proposal.proposalId;

  const stream = streamWithCommit({
    stream: reviewGovernanceStream(input),
    pickFinal: (event) =>
      event.type === "final" ? (event.output as GovernanceFinal) : null,
    commit: async (final) =>
      commitGovernanceVerdict({
        proposalId,
        decision: final.decision,
        blob: {
          schema: "governance-reviewer/v1",
          chain: "base-sepolia",
          proposalId,
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
