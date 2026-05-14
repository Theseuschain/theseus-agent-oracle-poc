/**
 * Helper: wrap an LLM SSE stream so that the verdict is committed
 * on-chain after streaming finishes, and the resulting tx info is
 * sent as one final SSE event before the stream closes.
 *
 * Used by every gate-shape agent's API route (Terra inlines the
 * logic directly because it was the proof-of-concept; the other four
 * route through this helper to stay short).
 */

import { sse } from "../llm-stream";
import type { Hex } from "viem";

export interface CommitOutcomeLike {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  blobUrl: string | null;
}

interface Args<TEvent, TFinal> {
  /** The agent's existing async-iterable LLM stream. */
  stream: AsyncIterable<TEvent>;
  /** Extracts the final verdict from a `final`-shaped event. Returns
   *  null for any event that isn't the terminal one. */
  pickFinal: (event: TEvent) => TFinal | null;
  /** Invoked once the LLM has produced its final verdict. The agent
   *  module is responsible for blob publication, contract write, and
   *  returning the tx info. Errors are caught and surfaced as
   *  `commit_error` events. */
  commit: (final: TFinal) => Promise<CommitOutcomeLike>;
}

export function streamWithCommit<TEvent, TFinal>({
  stream,
  pickFinal,
  commit,
}: Args<TEvent, TFinal>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let finalOutput: TFinal | null = null;
      try {
        for await (const event of stream) {
          controller.enqueue(encoder.encode(sse(event as object)));
          const f = pickFinal(event);
          if (f !== null) finalOutput = f;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(sse({ type: "error", error: msg })));
        controller.close();
        return;
      }

      if (!finalOutput) {
        controller.close();
        return;
      }

      if (!process.env.AGENT_PRIVATE_KEY) {
        controller.enqueue(
          encoder.encode(
            sse({
              type: "commit_skipped",
              reason:
                "AGENT_PRIVATE_KEY not configured; verdict not posted on-chain",
            }),
          ),
        );
        controller.close();
        return;
      }

      try {
        const outcome = await commit(finalOutput);
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
      controller.close();
    },
  });
}
