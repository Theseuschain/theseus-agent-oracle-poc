import { NextRequest, NextResponse } from "next/server";
import { adjudicateStream } from "@/lib/adjudicator-llm";
import { findMarket } from "@/lib/adjudicator-markets";
import { sse } from "@/lib/llm-stream";

export const dynamic = "force-dynamic";
export const maxDuration = 90;
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of adjudicateStream({ market })) {
          controller.enqueue(encoder.encode(sse(event)));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(sse({ type: "error", error: msg })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
