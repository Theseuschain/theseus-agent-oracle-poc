/**
 * Browser-sandbox version of the resolver_oracle.ship agent from
 * github.com/Theseuschain/the-prediction-market.
 *
 * Same shape, same input/output, same system-prompt spirit. The only
 * difference: the on-chain agent calls web_search / fetch_url /
 * get_price live; the demo hands the agent a pre-curated evidence
 * pack so the demo tests judgment quality, not search ability.
 *
 * Input matches the SHIP agent's MarketResolutionRequest (market_id,
 * question, options, resolution_criteria, resolution_source). Output
 * matches its ResolutionResult (market_id, winning_option,
 * confidence_pct, evidence_summary).
 */

import {
  extractPartialReasoning,
  readDeepSeekStream,
} from "./llm-stream";
import type { PredictionMarket } from "./adjudicator-markets";

export interface AdjudicateInput {
  market: PredictionMarket;
}

export interface ResolutionResult {
  marketId: number;
  winningOption: number;
  confidencePct: number;
  evidenceSummary: string;
  latencyMs?: number;
  model?: string;
  prompt?: { system: string; user: string };
  rawResponse?: string;
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

/** System prompt mirrors resolver_oracle.ship's prompt. The on-chain
 *  agent invokes tools to gather evidence; the demo agent receives
 *  the evidence pre-curated. The decision rules are the same. */
const SYSTEM_PROMPT = `You are a prediction market resolution oracle.

Your job is to determine the winning option for prediction markets by verifying facts against the resolution criteria.

## Rules
1. Read the resolution criteria carefully. They are the bar — adjacent facts that don't match the criteria don't count.
2. Compare each piece of evidence against the exact criteria.
3. Cite specific evidence indices in your evidence_summary. Every claim must trace to a numbered evidence item.
4. Return the INDEX of the winning option (0-based).
5. confidence_pct reflects how cleanly the evidence satisfies the criteria — high (≥80) when criteria are clearly met or clearly not met, lower when reasonable people would disagree.

## Output Format
Return a ResolutionResult with:
- market_id: the market_id from the request, unchanged
- winning_option: index of the winning option (0 to N-1)
- confidence_pct: your confidence level (0-100)
- evidence_summary: 80-180 words. Cite specific evidence indices in [brackets]. End with a one-line restatement of the verdict.

## Important
- Options are 0-indexed: first option is 0, second is 1, etc.
- You must pick exactly ONE winning option, even when ambiguous — but reflect the ambiguity in confidence_pct.
- Don't guess. If the evidence pack genuinely doesn't satisfy the criteria with the precision the question requires, pick the option the evidence best supports and use a low confidence_pct (50-70) to flag it.

OUTPUT: strict JSON, single object, no commentary.
{
  "market_id": <number>,
  "winning_option": <number>,
  "confidence_pct": <number>,
  "evidence_summary": <string>
}`;

function buildUserMessage(market: PredictionMarket): string {
  const optionsList = market.options
    .map((o, i) => `  ${i}. ${o}`)
    .join("\n");
  const evidenceList = market.evidence
    .map((e, i) => `  [${i}] ${e.source} (${e.date}): ${e.body}`)
    .join("\n");
  return `Please resolve this prediction market:

**Market ID**: ${market.marketId}

**Question**: ${market.question}

**Options** (0-indexed, pick by index number):
${optionsList}

**Resolution Criteria**: ${market.resolutionCriteria}

**Verification Source**: ${market.resolutionSource}

**Evidence Pack** (the agent's tool-call results, pre-supplied for this run):
${evidenceList}

Apply the rules. Return your resolution with the winning option INDEX (0 to ${market.options.length - 1}), a confidence_pct, and an evidence_summary.`;
}

interface ParsedResolution {
  market_id?: unknown;
  winning_option?: unknown;
  confidence_pct?: unknown;
  evidence_summary?: unknown;
}

function asNumber(x: unknown): number | undefined {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = parseFloat(x);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export type AdjudicateStreamEvent =
  | { type: "evidence_summary"; text: string }
  | { type: "final"; output: ResolutionResult };

export async function* adjudicateStream(
  input: AdjudicateInput,
): AsyncGenerator<AdjudicateStreamEvent, void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const userMessage = buildUserMessage(input.market);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let lastSummary: string | undefined;
  let finalContent = "";
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        stream: true,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`deepseek http ${res.status}: ${errText.slice(0, 200)}`);
    }
    for await (const content of readDeepSeekStream(res.body)) {
      finalContent = content;
      const partial = extractPartialReasoning(content, "evidence_summary");
      if (partial !== undefined && partial !== lastSummary) {
        lastSummary = partial;
        yield { type: "evidence_summary", text: partial };
      }
    }
  } finally {
    clearTimeout(timer);
  }

  if (!finalContent) throw new Error("deepseek: empty stream");

  let parsed: ParsedResolution;
  try {
    parsed = JSON.parse(finalContent) as ParsedResolution;
  } catch {
    throw new Error(`deepseek: non-JSON content: ${finalContent.slice(0, 200)}`);
  }

  const winning = asNumber(parsed.winning_option);
  const confidence = asNumber(parsed.confidence_pct);
  const marketId = asNumber(parsed.market_id) ?? input.market.marketId;
  const summary = String(parsed.evidence_summary ?? "no summary given");

  // Validate index range; if out of range, fall back to 0 with low confidence.
  const safeWinning =
    winning !== undefined &&
    Number.isInteger(winning) &&
    winning >= 0 &&
    winning < input.market.options.length
      ? winning
      : 0;
  const safeConfidence =
    confidence !== undefined && confidence >= 0 && confidence <= 100
      ? confidence
      : 0;

  yield {
    type: "final",
    output: {
      marketId,
      winningOption: safeWinning,
      confidencePct: safeConfidence,
      evidenceSummary: summary.slice(0, 1500),
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: finalContent,
    },
  };
}
