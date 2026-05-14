import { NextRequest, NextResponse } from "next/server";
import { adjudicateStream, type ResolutionResult } from "@/lib/adjudicator-llm";
import { findMarket } from "@/lib/adjudicator-markets";
import { commitAdjudicatorVerdict } from "@/lib/agent-onchain/adjudicator";
import { streamWithCommit } from "@/lib/agent-onchain/stream-commit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured on the server" },
      { status: 503 },
    );
  }

  let body: { marketId?: string };
  try {
    body = (await req.json()) as { marketId?: string };
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!body.marketId) {
    return NextResponse.json({ error: "missing marketId" }, { status: 400 });
  }

  const market = findMarket(body.marketId);
  if (!market) {
    return NextResponse.json(
      { error: `unknown market: ${body.marketId}` },
      { status: 404 },
    );
  }

  const stream = streamWithCommit({
    stream: adjudicateStream({ market }),
    pickFinal: (event) =>
      event.type === "final" ? (event.output as ResolutionResult) : null,
    commit: async (final) =>
      commitAdjudicatorVerdict({
        kind: "resolve",
        marketId: market.marketId,
        numOptions: market.options.length,
        winningOption: Math.max(
          0,
          Math.min(market.options.length - 1, final.winningOption),
        ),
        confidencePct: Math.max(0, Math.min(100, final.confidencePct)),
        blob: {
          schema: "prediction-market-adjudicator/v1",
          chain: "base-sepolia",
          market: {
            marketId: market.marketId,
            question: market.question,
            options: market.options,
          },
          resolution: final,
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
