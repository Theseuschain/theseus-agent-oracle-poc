/**
 * LLM evaluator for fresh token launches.
 *
 * Reads the dossier, calls Claude Haiku 4.5 with the same system prompt
 * that's published on the agent's Proof of Agenthood profile, and parses
 * a structured JSON decision back. The model sees real Base mainnet pool
 * state and decides PASS or BUY; the executor turns BUY into a paper
 * fill against the LaunchSniperFund contract.
 */

import Anthropic from "@anthropic-ai/sdk";
import { EVAL_MODEL_CHEAP } from "./config";
import type { AgentDecision, ResearchDossier } from "./types";

const SYSTEM_PROMPT = `You are Launch Sniper, a sovereign on-chain fund agent. You own your own paper capital (10,000 USDC virtual) and your job is to find the small fraction of fresh token launches that are worth owning.

You are paper-trading: your decisions are committed to a Base Sepolia LaunchSniperFund contract, but no real tokens move. The "fill price" is whatever the Base mainnet pool quotes at the block you tick. PnL is honest because the prices are real even though the capital is not.

## Mandate
Most launches are scams or noise. Most of the time, the right answer is PASS. You are not under pressure to deploy capital; you are under pressure to be right. The fund's lifetime grade is computed from win rate and Sharpe across decisions, not from gross volume.

## Decision checklist (run every evaluation)
1. **Contract sanity.** Is the source verified? If not, is the bytecode familiar (standard OZ ERC-20 with no surprises) or unfamiliar? Unfamiliar unverified = automatic PASS.
2. **Mint authority.** Can anyone still mint? Is there a transfer tax, blacklist, or pausable hook the team can flip? Any of these without a clear lockup = automatic PASS.
3. **Deployer history.** Has this deployer shipped successful tokens before? Or are they a serial scam deployer? If you can't tell, that's a yellow flag, not a green.
4. **Pool depth and liquidity lock.** Is the LP locked or owned by the deployer? Locked = ok. Owned and unlocked = automatic PASS (rug-pull shape).
5. **Holder concentration.** Top-10 holding >70% of supply on day one is suspicious unless there's an obvious treasury reason.
6. **Narrative.** Does the token have a coherent thesis you can articulate in one sentence? Memecoins with a recognizable hook are valid; vaporware with a buzzword soup is not.

## Sizing
- Hard PASS: skip.
- Soft BUY: 50 USDC, treating this as a low-conviction lottery ticket.
- Conviction BUY: up to 250 USDC, only when ALL of: source verified, mint authority renounced, LP locked, deployer track record clean.
- Never exceed 250 USDC per token. Never exceed 10% of paper USDC in any single position.

When a dossier field is missing from the input (Phase 1 only ships token metadata and pool state), treat the corresponding check as "unknown" in your output and let the missing signal weigh on the decision. Unknown source + unknown deployer = lean PASS unless something else is unusually compelling.

## Output Format
Strict JSON, single object, no commentary outside the object:
{
  "decision": "PASS" | "BUY",
  "size_usdc": <number, 0 for PASS, 50 or 250 for BUY>,
  "checks": {
    "source_verified": <bool or "unknown">,
    "mint_authority_renounced": <bool or "unknown">,
    "lp_locked": <bool or "unknown">,
    "deployer_clean": <bool or "unknown">,
    "top10_concentration": <0-1 fraction or "unknown">
  },
  "reason": <short tag, max 80 chars>,
  "reasoning": <one paragraph, 80-200 words, citing specific fields. End with "Buying $X." or "Passing.">
}`;

function fmtSupply(total: bigint, decimals: number): string {
  if (total === 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = total / divisor;
  return whole.toLocaleString();
}

function buildUserPrompt(dossier: ResearchDossier): string {
  const { candidate, token, pool } = dossier;
  const priceQuotePerToken = pool.initialized
    ? Number(pool.priceQuotePerToken_1e18) / 1e18
    : null;
  const lines = [
    "## Chain context",
    `  caller: 0xa6fbaadea4e7f58d812d989737d708b279e8bd21 (LaunchSniperFund, Base Sepolia)`,
    `  source chain: Base mainnet (chainId 8453)`,
    `  evaluating event from block: ${candidate.createdAtBlock.toLocaleString()}`,
    `  pool tx: ${candidate.txHash}`,
    `  evaluated at: ${dossier.assembledAt}`,
    "",
    "## Pool details",
    `  pool address: ${candidate.pool}`,
    `  quote token: ${candidate.quote} (${candidate.quoteAddress})`,
    `  fee tier: ${candidate.feeTier} (${candidate.feeTier / 10000}%)`,
    "",
    "## Token under evaluation",
    `  address: ${token.address}`,
    `  name: ${token.name}`,
    `  symbol: ${token.symbol}`,
    `  decimals: ${token.decimals}`,
    `  total supply: ${fmtSupply(token.totalSupply, token.decimals)}`,
    "",
    "## Live pool state",
    `  initialized: ${pool.initialized}`,
    `  price (${candidate.quote} per 1 ${token.symbol}): ${priceQuotePerToken !== null ? priceQuotePerToken.toExponential(4) : "n/a"}`,
    `  raw L (Uniswap V3 active-range liquidity, sqrt(token0*token1) units): ${pool.quoteSideLiquidity.toString()}`,
    "",
    "## Data the indexer did not fetch this round",
    "  verified source code (Basescan): not fetched in Phase 1",
    "  mint authority / owner state: not fetched in Phase 1",
    "  LP lock state: not fetched in Phase 1",
    "  deployer prior history: not fetched in Phase 1",
    "  top-10 holder concentration: not fetched in Phase 1",
    "",
    "Apply your checklist. Output strict JSON only.",
  ];
  return lines.join("\n");
}

function getAnthropicClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  return new Anthropic({ apiKey: key });
}

function coerceDecision(parsed: unknown): AgentDecision {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM returned non-object");
  }
  const p = parsed as Record<string, unknown>;
  const decision = p.decision === "BUY" ? "BUY" : "PASS";
  const sizeRaw = Number(p.size_usdc);
  const size = Number.isFinite(sizeRaw) ? sizeRaw : 0;
  // Hard guardrails on size (mirror the contract's checks server-side).
  const sizeUsdc = decision === "BUY" ? Math.min(Math.max(0, size), 250) : 0;
  const checks = (p.checks ?? {}) as Record<string, unknown>;
  return {
    decision,
    sizeUsdc,
    checks: {
      source_verified: parseTriState(checks.source_verified),
      mint_authority_renounced: parseTriState(checks.mint_authority_renounced),
      lp_locked: parseTriState(checks.lp_locked),
      deployer_clean: parseTriState(checks.deployer_clean),
      top10_concentration:
        typeof checks.top10_concentration === "number"
          ? checks.top10_concentration
          : "unknown",
    },
    reason: typeof p.reason === "string" ? p.reason : "",
    reasoning: typeof p.reasoning === "string" ? p.reasoning : "",
  };
}

function parseTriState(v: unknown): boolean | "unknown" {
  if (v === true || v === false) return v;
  return "unknown";
}

export async function evaluateDossier(
  dossier: ResearchDossier,
): Promise<{ decision: AgentDecision; model: string; raw: string }> {
  const anthropic = getAnthropicClient();
  const userPrompt = buildUserPrompt(dossier);

  const response = await anthropic.messages.create({
    model: EVAL_MODEL_CHEAP,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n")
      .trim() || "{}";

  // The model sometimes wraps JSON in ```json fences; strip them defensively.
  const json = stripJsonFences(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    // If JSON parsing fails entirely, escalate to a PASS with the error
    // surfaced in the reason. Better to skip than to gamble on a malformed
    // decision blob.
    return {
      decision: {
        decision: "PASS",
        sizeUsdc: 0,
        checks: {
          source_verified: "unknown",
          mint_authority_renounced: "unknown",
          lp_locked: "unknown",
          deployer_clean: "unknown",
          top10_concentration: "unknown",
        },
        reason: "llm-output-malformed",
        reasoning:
          "Evaluator returned non-JSON output; treating as PASS by default. Passing.",
      },
      model: EVAL_MODEL_CHEAP,
      raw: text,
    };
  }

  return {
    decision: coerceDecision(parsed),
    model: EVAL_MODEL_CHEAP,
    raw: text,
  };
}

function stripJsonFences(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  return t.trim();
}
