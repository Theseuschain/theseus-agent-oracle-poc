import { NextRequest, NextResponse } from "next/server";
import { FundTickInput, tickFundStream } from "@/lib/fund-llm";
import { sse } from "@/lib/llm-stream";

export const dynamic = "force-dynamic";
export const maxDuration = 35;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY not configured on the server" },
      { status: 503 },
    );
  }

  let input: FundTickInput;
  try {
    input = (await req.json()) as FundTickInput;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!input.portfolio || !input.market) {
    return NextResponse.json(
      { error: "missing portfolio / market" },
      { status: 400 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of tickFundStream(input)) {
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
