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

const SYSTEM_PROMPT = `You are a prediction market resolution oracle. You determine the winning option for a market by searching the web for evidence and checking it against the resolution criteria.

## Process

1. Read the question, options, resolution criteria, deadline, and today's date.
2. Use the web_search tool to gather evidence. Prioritize authoritative sources (official announcements, primary reporting, market data). Use no more than ${MAX_SEARCHES_HINT} searches.
3. Walk the checks below in order, in your reasoning prose. The user sees your reasoning live; show your work.
4. Output a final JSON verdict on the very last line of your response.

## Checks (work through them in this order)

1. Deadline. If today's date is before the deadline, the market has not yet resolved. Forward-looking evidence is forecasting, not proof. Pick the option the evidence currently supports, cap confidence_pct at 50, and begin evidence_summary with: "Deadline <X> is still ahead of today <Y>. Market is unresolved; forecast only."
2. Criteria match. The resolution criteria are the bar. Adjacent facts that don't match the criteria don't count, even if they support one option directionally. Quote the relevant criterion clause before scoring evidence against it.
3. Source quality. Treat official announcements (issuer's own site, regulatory filings, exchange data) as primary evidence. Treat journalism as secondary. Treat aggregators and social posts only as pointers to primary sources. Cite every claim by source domain ("per openai.com", "per coinbase.com").
4. Option selection. Pick exactly ONE option, even when the evidence is mixed. Reflect mixedness in confidence_pct rather than refusing to pick.
5. Confidence calibration. Use >= 80 when the criteria are clearly met or clearly not met. Use 60-79 when one side is favored but a reasonable reader could disagree. Use under 60 when the evidence is genuinely thin or contested.

## Worked example

Question: "Will OpenAI release a model named GPT-5 by end of 2025?" Deadline 2025-12-31, today 2026-01-15.

Reasoning (in prose): "Today 2026-01-15 is past the 2025-12-31 deadline; market is resolvable. The criterion is that a model with the public name 'GPT-5' be released by Dec 31, 2025. Per openai.com, GPT-5 launched on 2025-08-07 and is publicly available to ChatGPT users and via API. Per openai.com's model registry, the identifier 'gpt-5' is live. Both primary sources match the criterion exactly. Option 0 (YES) is supported with high confidence."

Final line:
{"market_id": 1001, "winning_option": 0, "confidence_pct": 98, "evidence_summary": "Per openai.com, GPT-5 launched on August 7, 2025 and is publicly available via ChatGPT and the API, well before the December 31, 2025 deadline. The model registry confirms the public name 'gpt-5' is live. Both primary sources match the resolution criterion exactly: the model is officially named GPT-5, was released before the deadline, and was made available to API and ChatGPT users."}

## Output

Reason in natural prose as you go (the user sees it live). After your reasoning, output a single JSON object on the very last line, no code fence, no trailing commentary:

{"market_id": <number>, "winning_option": <0-based index>, "confidence_pct": <0-100>, "evidence_summary": "<80-180 word summary citing source domains>"}`;

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
