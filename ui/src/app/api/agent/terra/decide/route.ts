import { NextRequest, NextResponse } from "next/server";
import { decideTerraStream, TerraDecideInput } from "@/lib/terra-llm";
import { sse } from "@/lib/llm-stream";
import { commitTerraVerdict } from "@/lib/agent-onchain/terra";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY not configured on the server" },
      { status: 503 },
    );
  }

  let input: TerraDecideInput;
  try {
    input = (await req.json()) as TerraDecideInput;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!input.vault || !input.action || typeof input.ustdAmount !== "number") {
    return NextResponse.json({ error: "missing vault / action / ustdAmount" }, { status: 400 });
  }
  if (input.action !== "MINT" && input.action !== "REDEEM") {
    return NextResponse.json({ error: "action must be MINT or REDEEM" }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let finalOutput: { decision: "ALLOW" | "REFUSE"; reason: string; reasoning: string; latencyMs?: number; model?: string } | null = null;
      try {
        for await (const event of decideTerraStream(input)) {
          controller.enqueue(encoder.encode(sse(event)));
          if (event.type === "final") {
            finalOutput = event.output;
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(sse({ type: "error", error: msg })));
        controller.close();
        return;
      }

      // After the LLM stream finishes, commit the verdict on-chain.
      // Failures here don't roll back the UI verdict; they're surfaced
      // as a separate event so the UI can show "uncommitted" gracefully.
      if (finalOutput && process.env.AGENT_PRIVATE_KEY) {
        try {
          const outcome = await commitTerraVerdict({
            action: input.action,
            decision: finalOutput.decision,
            blob: {
              schema: "terra-failsafe/v1",
              chain: "base-sepolia",
              input,
              verdict: finalOutput,
              committedAt: new Date().toISOString(),
            },
          });
          controller.enqueue(
            encoder.encode(
              sse({
                type: "committed",
                txHash: outcome.txHash,
                txUrl: outcome.txUrl,
                reasonHash: outcome.reasonHash,
                blobUrl: outcome.blobUrl,
              }),
            ),
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          controller.enqueue(
            encoder.encode(sse({ type: "commit_error", error: msg })),
          );
        }
      } else if (finalOutput) {
        controller.enqueue(
          encoder.encode(
            sse({
              type: "commit_skipped",
              reason: "AGENT_PRIVATE_KEY not configured; verdict not posted on-chain",
            }),
          ),
        );
      }

      controller.close();
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
