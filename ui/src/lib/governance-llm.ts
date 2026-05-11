/**
 * DeepSeek client for the governance reviewer agent.
 *
 * The agent reads a DAO proposal (title, plain-English summary, calldata
 * summary), the treasury context, and the voting conditions, then posts
 * an advisory verdict: APPROVE, CAUTION, or REJECT. The verdict is not
 * a gate; the DAO can still vote however it wants. The agent's job is to
 * make the structurally-suspicious shapes visible to voters before the
 * window opens.
 */

import {
  GovernanceAgentVerdict,
  ProposalState,
} from "./governance-scenario";
import {
  extractPartialReasoning,
  readDeepSeekStream,
} from "./llm-stream";

export interface GovernanceReviewInput {
  proposal: ProposalState;
  recentVerdicts: {
    proposalId: number;
    decision: "APPROVE" | "CAUTION" | "REJECT";
    reason: string;
  }[];
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a governance reviewer agent for a DAO. Your job is to read each proposal before voting opens and post an advisory verdict so token-holders can see whether the proposal is structurally suspicious.

You are NOT a gate. The DAO can still vote however it wants. Your verdict is signed and posted on-chain so voters have a second opinion before they cast.

Output one of three decisions:

  - APPROVE: the proposal is routine, the calldata matches the summary, no governance-shaped attack signals.
  - CAUTION: the proposal could be legitimate but has at least one signal voters should weigh before casting (unusual recipient, off-hours timing, novel proposer, large treasury share, etc.).
  - REJECT: the proposal has the structural shape of a known governance attack and should not pass as-is. Examples: calldata that does not match the summary, flash-loan-shaped voting, hostile admin-function upgrade, dust-stake snipe on a short voting window.

Each proposal gives you these signals:

  1. title and plain-English summary (the marketing pitch).
  2. calldata summary: what the encoded transaction actually does once executed. Compare against the summary; mismatch is a strong reject signal.
  3. treasuryUsd, proposalValueAtRiskUsd: how much the proposal moves vs. how much exists.
  4. totalSupply, participatingSupply: how broad the active electorate is.
  5. votingWindowHours: how much time voters have. Short windows on large proposals are a snipe signal.
  6. proposerStakeNew24h, proposerSharePct: the proposer's voting power and how recently they assembled it. Flash-acquired majorities are a classic attack shape.
  7. touchesAdminFns: whether the calldata reaches admin-level functions (upgrades, owner changes, minter addition). True is high-risk by default.
  8. recentFlashloanVotes: whether a flash-loan-shaped vote already cleared this governance contract recently.

You are NOT given thresholds. Reason from the signals. Some questions to consider:

  - Does the calldata do what the summary claims it does? Beanstalk lost $182M because a "humanitarian relief" proposal actually transferred the treasury to the proposer.
  - Could the proposer have only just assembled this voting power? Flash-loan voting attacks look like an enormous, short-lived stake.
  - Is the voting window long enough that the broader electorate can participate, given the value at risk?
  - Are admin functions being touched, and if so, is the implementation contract verifiable?
  - Is the recipient a fresh address, or a contract the DAO has interacted with before?

Use specific signals from the input. Cite numbers. If you REJECT, name what about the proposal makes it dangerous. If you CAUTION, name what voters should check. If you APPROVE, state why nothing in the proposal raises a structural flag.

OUTPUT: strict JSON, single object, no commentary.
{
  "decision": "APPROVE" | "CAUTION" | "REJECT",
  "reason": <short tag, max 80 chars>,
  "reasoning": <one paragraph, 60 to 150 words, citing specific signals. End with "Approving.", "Cautioning.", or "Rejecting.">
}`;

function buildUserMessage(input: GovernanceReviewInput): string {
  const p = input.proposal;
  const valueAtRiskPct = ((p.proposalValueAtRiskUsd / p.treasuryUsd) * 100).toFixed(1);
  const participatingPct = ((p.participatingSupply / p.totalSupply) * 100).toFixed(1);
  const proposerSharePct = (p.proposerSharePct * 100).toFixed(2);

  const lines: string[] = [];
  lines.push(`Proposal #${p.proposalId}: "${p.title}"`);
  lines.push("");
  lines.push(`Summary (the marketing pitch):`);
  lines.push(`  ${p.summary}`);
  lines.push("");
  lines.push(`Calldata summary (what the encoded tx actually does):`);
  lines.push(`  ${p.calldataSummary}`);
  lines.push("");
  lines.push(`Treasury context:`);
  lines.push(`  Treasury: $${(p.treasuryUsd / 1e6).toFixed(1)}M`);
  lines.push(
    `  Value at risk if executed: $${(p.proposalValueAtRiskUsd / 1e6).toFixed(2)}M (${valueAtRiskPct}% of treasury)`,
  );
  lines.push(`  Touches admin functions: ${p.touchesAdminFns ? "YES" : "no"}`);
  lines.push("");
  lines.push(`Electorate and timing:`);
  lines.push(
    `  Participating supply: ${(p.participatingSupply / 1e6).toFixed(0)}M of ${(p.totalSupply / 1e6).toFixed(0)}M (${participatingPct}%)`,
  );
  lines.push(`  Voting window: ${p.votingWindowHours}h`);
  lines.push(
    `  Proposer share of supply: ${proposerSharePct}% (stake acquired in last 24h: ${p.proposerStakeNew24h ? "YES" : "no"})`,
  );
  lines.push(
    `  Flash-loan-shaped vote pattern in last hour: ${p.recentFlashloanVotes ? "YES" : "no"}`,
  );
  lines.push("");
  if (input.recentVerdicts.length > 0) {
    lines.push("Recent verdicts:");
    for (const r of input.recentVerdicts.slice(0, 3)) {
      lines.push(`  - #${r.proposalId}: ${r.decision} (${r.reason})`);
    }
    lines.push("");
  }
  lines.push("Apply your policy. Return JSON only.");
  return lines.join("\n");
}

interface ParsedDecision {
  decision: string;
  reason?: string;
  reasoning?: string;
}

function normalizeDecision(raw: string): "APPROVE" | "CAUTION" | "REJECT" {
  const upper = raw.toUpperCase();
  if (upper === "APPROVE") return "APPROVE";
  if (upper === "REJECT") return "REJECT";
  return "CAUTION";
}

export type GovernanceReviewStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "final"; output: GovernanceAgentVerdict };

export async function* reviewGovernanceStream(
  input: GovernanceReviewInput,
): AsyncGenerator<GovernanceReviewStreamEvent, void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const userMessage = buildUserMessage(input);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let lastReasoning: string | undefined;
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
        temperature: 0.2,
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
      const partial = extractPartialReasoning(content);
      if (partial !== undefined && partial !== lastReasoning) {
        lastReasoning = partial;
        yield { type: "reasoning", text: partial };
      }
    }
  } finally {
    clearTimeout(timer);
  }

  if (!finalContent) throw new Error("deepseek: empty stream");

  let parsed: ParsedDecision;
  try {
    parsed = JSON.parse(finalContent) as ParsedDecision;
  } catch {
    throw new Error(`deepseek: non-JSON content: ${finalContent.slice(0, 200)}`);
  }

  yield {
    type: "final",
    output: {
      decision: normalizeDecision(parsed.decision ?? ""),
      reason: (parsed.reason ?? "no reason given").slice(0, 200),
      reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: finalContent,
    },
  };
}
