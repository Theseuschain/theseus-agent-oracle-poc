// Streaming helpers for DeepSeek calls.
//
// Both agent demos (Aave oracle, Terra failsafe) ask DeepSeek to return
// strict JSON with a `reasoning` field. While the model streams that
// JSON token by token, we want to surface the reasoning text live in
// the timeline. The wow-factor on first paint comes from watching the
// agent think instead of waiting 3 seconds for a verdict to drop.
//
// This file holds:
//   - extractPartialReasoning: state-machine that pulls the
//     in-progress text of a JSON `"reasoning":"..."` field out of a
//     partially-streamed JSON buffer, with proper escape handling.
//   - readDeepSeekStream: helper that consumes DeepSeek's SSE
//     response and yields the cumulative content string after each
//     delta.
//   - sse: tiny helper to format a server-sent event line.

/** Pull the unescaped text of a string-valued JSON field out of a
 *  partially-streamed JSON string. Returns undefined if the field
 *  hasn't started yet, and the text-so-far while it's still being
 *  emitted. Once the closing quote arrives the returned value stops
 *  changing. Default field is "reasoning"; pass another for agents
 *  that stream a differently-named text field (e.g. "evidence_summary"
 *  on the prediction-market resolver). */
export function extractPartialReasoning(
  buffer: string,
  field: string = "reasoning",
): string | undefined {
  const key = `"${field}":"`;
  const idx = buffer.indexOf(key);
  if (idx === -1) return undefined;
  let i = idx + key.length;
  let out = "";
  while (i < buffer.length) {
    const c = buffer[i];
    if (c === "\\") {
      const next = buffer[i + 1];
      if (next === undefined) break; // partial escape, wait for next chunk
      if (next === '"') out += '"';
      else if (next === "\\") out += "\\";
      else if (next === "/") out += "/";
      else if (next === "n") out += "\n";
      else if (next === "t") out += "\t";
      else if (next === "r") out += "\r";
      else if (next === "b") out += "\b";
      else if (next === "f") out += "\f";
      else if (next === "u") {
        if (i + 5 >= buffer.length) break;
        const hex = buffer.slice(i + 2, i + 6);
        const code = parseInt(hex, 16);
        if (!Number.isNaN(code)) out += String.fromCharCode(code);
        i += 6;
        continue;
      } else {
        out += next;
      }
      i += 2;
      continue;
    }
    if (c === '"') break; // end of reasoning string
    out += c;
    i += 1;
  }
  return out;
}

interface DeepSeekStreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}

/** Consume DeepSeek's SSE response body. Yields the accumulated content
 *  string after each delta. Stops on `[DONE]` or stream end. */
export async function* readDeepSeekStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by \n\n. Process complete events; keep
      // any tail in the buffer for the next chunk.
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        for (const line of evt.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "" || data === "[DONE]") continue;
          let parsed: DeepSeekStreamChunk;
          try {
            parsed = JSON.parse(data) as DeepSeekStreamChunk;
          } catch {
            continue;
          }
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            content += delta;
            yield content;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return content;
}

/** Format a server-sent event line. */
export function sse(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
