/**
 * One full tick of the launch-sniper loop.
 *
 * Sequence:
 *  1. Fetch fresh PoolCreated candidates from Base mainnet (oldest first).
 *  2. Skip any token the LaunchSniperFund contract has already touched.
 *  3. Pick the first remaining candidate.
 *  4. Build a research dossier (token metadata + pool state).
 *  5. Send the dossier to Claude Haiku 4.5 for evaluation.
 *  6. Execute the decision on-chain (PASS or BUY tick on Sepolia).
 *  7. Return a structured result the API route can echo back.
 *
 * Side effects: writes one transaction to Base Sepolia, signed by the
 * agent EOA.
 */

import { evaluateDossier } from "./evaluator";
import { executeTick, isAlreadyTouched, readPaperUsdc } from "./executor";
import { fetchRecentCandidates } from "./indexer";
import { buildDossier } from "./research";

export interface LoopOutcome {
  status: "ticked" | "no-candidates" | "all-touched" | "error";
  candidatesFound?: number;
  candidatesUntouched?: number;
  picked?: {
    pool: string;
    token: string;
    quote: string;
    feeTier: number;
    createdAtBlock: string;
  };
  tokenMetadata?: {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  };
  decision?: {
    action: "PASS" | "BUY_TOKEN";
    sizeUsdc: number;
    reason: string;
    reasoningExcerpt: string;
  };
  tx?: {
    hash: string;
    explorerUrl: string;
    reasonHash: string;
    blobUrl: string | null;
  };
  paperUsdcAfter?: string;
  error?: string;
}

export async function runOneTick(): Promise<LoopOutcome> {
  let candidates: Awaited<ReturnType<typeof fetchRecentCandidates>>;
  try {
    candidates = await fetchRecentCandidates();
  } catch (err) {
    return {
      status: "error",
      error: `indexer: ${(err as Error).message}`,
    };
  }
  if (candidates.length === 0) {
    return { status: "no-candidates", candidatesFound: 0 };
  }

  // Skip already-touched tokens. The contract is authoritative state.
  let picked: (typeof candidates)[number] | null = null;
  let untouchedCount = 0;
  for (const c of candidates) {
    let touched = false;
    try {
      touched = await isAlreadyTouched(c.token);
    } catch {
      // If the Sepolia read fails, fail open: treat as touched and skip
      // to be safe; another tick will retry once the RPC heals.
      touched = true;
    }
    if (!touched) {
      untouchedCount++;
      if (!picked) picked = c;
    }
  }
  if (!picked) {
    return {
      status: "all-touched",
      candidatesFound: candidates.length,
      candidatesUntouched: 0,
    };
  }

  let dossier: Awaited<ReturnType<typeof buildDossier>>;
  try {
    dossier = await buildDossier(picked);
  } catch (err) {
    return {
      status: "error",
      candidatesFound: candidates.length,
      candidatesUntouched: untouchedCount,
      error: `research: ${(err as Error).message}`,
    };
  }

  let evaluation: Awaited<ReturnType<typeof evaluateDossier>>;
  try {
    evaluation = await evaluateDossier(dossier);
  } catch (err) {
    return {
      status: "error",
      candidatesFound: candidates.length,
      candidatesUntouched: untouchedCount,
      error: `evaluator: ${(err as Error).message}`,
    };
  }

  let exec: Awaited<ReturnType<typeof executeTick>>;
  try {
    exec = await executeTick(dossier, evaluation.decision, evaluation.model);
  } catch (err) {
    return {
      status: "error",
      candidatesFound: candidates.length,
      candidatesUntouched: untouchedCount,
      error: `executor: ${(err as Error).message}`,
    };
  }

  const paperUsdc = await readPaperUsdc().catch(() => 0n);

  return {
    status: "ticked",
    candidatesFound: candidates.length,
    candidatesUntouched: untouchedCount,
    picked: {
      pool: picked.pool,
      token: picked.token,
      quote: picked.quote,
      feeTier: picked.feeTier,
      createdAtBlock: picked.createdAtBlock.toString(),
    },
    tokenMetadata: {
      name: dossier.token.name,
      symbol: dossier.token.symbol,
      decimals: dossier.token.decimals,
      totalSupply: dossier.token.totalSupply.toString(),
    },
    decision: {
      action: exec.action,
      sizeUsdc: evaluation.decision.sizeUsdc,
      reason: evaluation.decision.reason,
      reasoningExcerpt: evaluation.decision.reasoning.slice(0, 280),
    },
    tx: {
      hash: exec.txHash,
      explorerUrl: `https://sepolia.basescan.org/tx/${exec.txHash}`,
      reasonHash: exec.reasonHash,
      blobUrl: exec.blobUrl,
    },
    paperUsdcAfter: paperUsdc.toString(),
  };
}
