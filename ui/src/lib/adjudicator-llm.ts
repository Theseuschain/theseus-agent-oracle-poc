/**
 * Browser-sandbox version of the resolver_oracle.ship agent from
 * github.com/Theseuschain/the-prediction-market.
 *
 * Same shape, same input/output. The agent reads the question,
 * options, criteria, deadline, and today's date, then calls
 * Anthropic's built-in web_search tool to gather evidence fresh on
 * every run. Output matches the SHIP agent's ResolutionResult
 * (market_id, winning_option, confidence_pct, evidence_summary),
 * extended with the citations the agent pulled.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Citation, PredictionMarket } from "./adjudicator-markets";

export interface AdjudicateInput {
  market: PredictionMarket;
}

export interface ResolutionResult {
  marketId: number;
  winningOption: number;
  confidencePct: number;
  evidenceSummary: string;
  citations: Citation[];
  latencyMs?: number;
  model?: string;
  prompt?: { system: string; user: string };
  rawResponse?: string;
}

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 4096;
const MAX_SEARCHES_HINT = 4;

const SYSTEM_PROMPT = `You are a prediction market resolution oracle.

Your job is to determine the winning option for a prediction market by searching the web for evidence and verifying facts against the resolution criteria.

## Process
1. Read the question, options, resolution criteria, deadline, and today's date.
2. Use the web_search tool to gather evidence. Prioritize authoritative sources (official announcements, primary reporting, market data). Use no more than ${MAX_SEARCHES_HINT} searches.
3. Compare the evidence against the resolution criteria.
4. Decide which option the evidence best supports.
5. Output a final JSON verdict on the last line of your response.

## Rules
1. The resolution criteria are the bar; adjacent facts that don't match the criteria don't count.
2. confidence_pct reflects how cleanly the evidence satisfies the criteria. Use high values (>= 80) when criteria are clearly met or clearly not met; use lower values when reasonable people would disagree.
3. Check the deadline against today. A market with a future deadline has not yet resolved. Forward-looking evidence is forecasting and should not be treated as proof. Pick the option the evidence currently supports, cap confidence_pct at 50 (this overrides rule 2), and start your evidence_summary with: "Deadline <X> is still ahead of today <Y>. Market is unresolved; forecast only."
4. Cite specific facts with their source domain in your evidence_summary (for example, "per bloomberg.com" or "per apple.com"). Every claim should trace to something you found via search.
5. You must pick exactly ONE winning option, even when ambiguous; reflect the ambiguity in confidence_pct.

## Output
Reason in natural prose as you go; the user sees your reasoning live. After your reasoning, output a single JSON object on the last line of your response with this exact shape:

{"market_id": <number>, "winning_option": <0-based index>, "confidence_pct": <0-100>, "evidence_summary": "<80-180 word summary>"}

The JSON line must be the very last line. Do not wrap it in a code fence; emit plain JSON.`;

function buildUserMessage(market: PredictionMarket): string {
  const today = new Date().toISOString().slice(0, 10);
  const optionsList = market.options
    .map((o, i) => `  ${i}. ${o}`)
    .join("\n");
  return `Please resolve this prediction market:

**Market ID**: ${market.marketId}

**Question**: ${market.question}

**Options** (0-indexed, pick by index number):
${optionsList}

**Resolution Criteria**: ${market.resolutionCriteria}

**Verification Source**: ${market.resolutionSource}

**Deadline**: ${market.deadline}
**Today**: ${today}

Search the web for evidence, then return your verdict as the final JSON line.`;
}

export type AdjudicateStreamEvent =
  | { type: "search_started"; query: string }
  | { type: "search_results"; query: string; citations: Citation[] }
  | { type: "text_delta"; text: string }
  | { type: "final"; output: ResolutionResult };

interface ParsedVerdict {
  market_id?: number;
  winning_option?: number;
  confidence_pct?: number;
  evidence_summary?: string;
}

function asNumber(x: unknown): number | undefined {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = parseFloat(x);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function extractVerdict(text: string): ParsedVerdict {
  const trimmed = text.trim();
  const lines = trimmed.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        return JSON.parse(line) as ParsedVerdict;
      } catch {
        // try next
      }
    }
  }
  // Fallback: scan from the last `{` and find a balanced object.
  const lastBrace = trimmed.lastIndexOf("{");
  if (lastBrace >= 0) {
    const tail = trimmed.slice(lastBrace);
    let depth = 0;
    let end = -1;
    let inString = false;
    let escape = false;
    for (let i = 0; i < tail.length; i++) {
      const ch = tail[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
    if (end > 0) {
      try {
        return JSON.parse(tail.slice(0, end)) as ParsedVerdict;
      } catch {
        // give up
      }
    }
  }
  return {};
}

export async function* adjudicateStream(
  input: AdjudicateInput,
): AsyncGenerator<AdjudicateStreamEvent, void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });
  const userMessage = buildUserMessage(input.market);
  const t0 = Date.now();

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        // Haiku 4.5 doesn't support programmatic tool calling; force the
        // direct-invocation mode so search runs without dynamic filtering.
        allowed_callers: ["direct"],
      },
    ],
  });

  // server_tool_use blocks stream the tool input as input_json_delta. We
  // accumulate per index and emit `search_started` once the block closes.
  // `web_search_tool_result` blocks land already-populated; we read their
  // content directly.
  const pendingSearchInputs = new Map<number, string>();
  const finishedQueriesByIndex = new Map<number, string>();
  // The result block follows its tool_use block; track the most recent
  // query so we can pair it with results.
  let lastQuery = "";
  const fullText: string[] = [];
  const allCitations: Citation[] = [];

  for await (const event of stream) {
    if (event.type === "content_block_start") {
      const block = event.content_block;
      if (block.type === "server_tool_use" && block.name === "web_search") {
        pendingSearchInputs.set(event.index, "");
      } else if (block.type === "web_search_tool_result") {
        const raw = (block as { content?: unknown }).content;
        if (Array.isArray(raw)) {
          const cites: Citation[] = raw
            .filter(
              (it): it is { type: string; url?: unknown; title?: unknown } =>
                !!it && typeof it === "object" && (it as { type?: string }).type === "web_search_result",
            )
            .map((it) => ({
              url: typeof it.url === "string" ? it.url : "",
              title: typeof it.title === "string" ? it.title : "",
            }))
            .filter((c) => c.url);
          for (const c of cites) {
            if (!allCitations.some((existing) => existing.url === c.url)) {
              allCitations.push(c);
            }
          }
          yield { type: "search_results", query: lastQuery, citations: cites };
        }
      }
    } else if (event.type === "content_block_delta") {
      const delta = event.delta;
      if (delta.type === "input_json_delta" && pendingSearchInputs.has(event.index)) {
        const prev = pendingSearchInputs.get(event.index) ?? "";
        pendingSearchInputs.set(event.index, prev + delta.partial_json);
      } else if (delta.type === "text_delta") {
        fullText.push(delta.text);
        yield { type: "text_delta", text: delta.text };
      }
    } else if (event.type === "content_block_stop") {
      if (pendingSearchInputs.has(event.index)) {
        const raw = pendingSearchInputs.get(event.index) ?? "";
        pendingSearchInputs.delete(event.index);
        try {
          const parsed = JSON.parse(raw) as { query?: string };
          if (typeof parsed.query === "string" && parsed.query.length > 0) {
            lastQuery = parsed.query;
            finishedQueriesByIndex.set(event.index, parsed.query);
            yield { type: "search_started", query: parsed.query };
          }
        } catch {
          // ignore unparseable partial json
        }
      }
    }
  }

  await stream.finalMessage();
  const text = fullText.join("");
  const parsed = extractVerdict(text);

  const winning = asNumber(parsed.winning_option);
  const rawConfidence = asNumber(parsed.confidence_pct);
  const marketId = asNumber(parsed.market_id) ?? input.market.marketId;
  const summary = String(parsed.evidence_summary ?? "no summary returned");

  const safeWinning =
    winning !== undefined &&
    Number.isInteger(winning) &&
    winning >= 0 &&
    winning < input.market.options.length
      ? winning
      : 0;
  const baseConfidence =
    rawConfidence !== undefined && rawConfidence >= 0 && rawConfidence <= 100
      ? rawConfidence
      : 0;

  // Backstop for rule 3. Model sometimes follows the prose rule (open
  // with "forecast only") yet ignores the numeric cap.
  const today = new Date().toISOString().slice(0, 10);
  const deadlineFuture = input.market.deadlineISO > today;
  const safeConfidence =
    deadlineFuture && baseConfidence > 50 ? 50 : baseConfidence;

  yield {
    type: "final",
    output: {
      marketId,
      winningOption: safeWinning,
      confidencePct: safeConfidence,
      evidenceSummary: summary.slice(0, 1500),
      citations: allCitations,
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: text,
    },
  };
}
