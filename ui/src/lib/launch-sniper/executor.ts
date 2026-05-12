/**
 * Paper executor.
 *
 * Translates an AgentDecision + dossier into an on-chain tick on the
 * Base Sepolia LaunchSniperFund. PASS records the token without moving
 * money; BUY computes a paper fill from the mainnet pool's current
 * price and writes both legs into the tick.
 *
 * The reason blob (full dossier + decision) is published as a JSON
 * artifact; we hash it with keccak256 and commit the hash on-chain via
 * the reasonHash field, in line with the other agents' commitment
 * surfaces. In Phase 2 we host the blob; for now the hash alone is the
 * on-chain commitment.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import {
  ACTION,
  LAUNCH_SNIPER_FUND_ABI,
  ERC20_ABI,
} from "./abi";
import { publishBlob } from "./blob-store";
import {
  BASE_SEPOLIA_RPC,
  LAUNCH_SNIPER_FUND_SEPOLIA,
} from "./config";
import { getMainnetClient } from "./indexer";
import type {
  AgentDecision,
  ReasonBlob,
  ResearchDossier,
} from "./types";

function getAgentAccount() {
  const raw = process.env.AGENT_PRIVATE_KEY;
  if (!raw) {
    throw new Error("AGENT_PRIVATE_KEY not configured");
  }
  const hex = raw.startsWith("0x") ? (raw as Hex) : (`0x${raw}` as Hex);
  return privateKeyToAccount(hex);
}

function getSepoliaPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });
}

function getSepoliaWalletClient() {
  return createWalletClient({
    account: getAgentAccount(),
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });
}

/** Returns true if the contract has already evaluated this token. */
export async function isAlreadyTouched(token: Address): Promise<boolean> {
  const client = getSepoliaPublicClient();
  const count = (await client.readContract({
    address: LAUNCH_SNIPER_FUND_SEPOLIA,
    abi: LAUNCH_SNIPER_FUND_ABI,
    functionName: "tokenCount",
  })) as bigint;

  for (let i = 0n; i < count; i++) {
    const t = (await client.readContract({
      address: LAUNCH_SNIPER_FUND_SEPOLIA,
      abi: LAUNCH_SNIPER_FUND_ABI,
      functionName: "tokens",
      args: [i],
    })) as Address;
    if (t.toLowerCase() === token.toLowerCase()) return true;
  }
  return false;
}

export async function readPaperUsdc(): Promise<bigint> {
  const client = getSepoliaPublicClient();
  return (await client.readContract({
    address: LAUNCH_SNIPER_FUND_SEPOLIA,
    abi: LAUNCH_SNIPER_FUND_ABI,
    functionName: "paperUsdc",
  })) as bigint;
}

/** Build the JSON reason blob and return [blob, keccak256(blob)]. */
function buildReasonBlob(
  dossier: ResearchDossier,
  decision: AgentDecision,
  model: string,
  paperFill?: ReasonBlob["paperFill"],
): { blob: ReasonBlob; hash: Hex } {
  const blob: ReasonBlob = {
    schema: "launch-sniper/v1",
    dossier,
    decision,
    paperFill,
    model,
    evaluatedAt: new Date().toISOString(),
  };
  const json = JSON.stringify(blob, bigintReplacer);
  const hash = keccak256(toBytes(json));
  return { blob, hash };
}

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

/** Compute the paper amountToken (in token's native decimals) for a
 *  given USDC spend at the dossier's pool price. Returns 0n if the
 *  pool is uninitialized or the price is zero. */
function computePaperFill(
  dossier: ResearchDossier,
  spendUsdc: number,
): { tokenAmount: bigint; quoteAmount: bigint } | null {
  const { pool, token, candidate } = dossier;
  if (!pool.initialized || pool.priceQuotePerToken_1e18 === 0n) return null;
  if (candidate.quote !== "USDC") {
    // Phase 1 paper-fund accounting is in USDC. WETH-quoted launches
    // require either a WETH→USDC conversion at the current oracle
    // price or a richer ledger. Phase 2 territory; for now we PASS at
    // the executor layer rather than fill against the wrong unit.
    return null;
  }
  // spendUsdc is human dollars; convert to 6-decimal USDC raw units.
  const quoteAmount = BigInt(Math.floor(spendUsdc * 1_000_000));
  // tokenOut = quoteAmount * 1e18 / priceQuotePerToken_1e18, then scale
  // for token decimals vs quote (USDC = 6). priceQuotePerToken_1e18 is
  // already in human-priced units (quote per token, scaled by 1e18 of
  // numeric precision regardless of decimals).
  if (pool.priceQuotePerToken_1e18 === 0n) return null;
  // tokenAmount_in_tokenDecimals
  //   = quoteAmount / priceQuotePerToken
  //   = quoteAmount * 1e18 / priceQuotePerToken_1e18
  // priceQuotePerToken_1e18 has units (USDC humans / 1 token human) * 1e18.
  // We want token raw units. Each "token human" is 10^decimalsToken raw,
  // each "USDC human" is 10^6 raw. So:
  //   tokenRaw = quoteRaw * 10^decimalsToken / (priceHuman * 10^6)
  //   where priceHuman = priceQuotePerToken_1e18 / 1e18
  // Therefore:
  //   tokenRaw = quoteRaw * 10^decimalsToken * 1e18
  //              / (priceQuotePerToken_1e18 * 10^6)
  const num = quoteAmount * 10n ** BigInt(token.decimals) * 10n ** 18n;
  const den = pool.priceQuotePerToken_1e18 * 10n ** 6n;
  if (den === 0n) return null;
  const tokenAmount = num / den;
  if (tokenAmount === 0n) return null;
  return { tokenAmount, quoteAmount };
}

/** Optional sanity check before BUY: the pool must hold actual quote-side
 *  liquidity. A pool with zero quote-side balance means anyone trying to
 *  swap into the token will revert. */
async function quoteBalanceInPool(
  pool: Address,
  quoteAddress: Address,
): Promise<bigint> {
  const client = getMainnetClient();
  try {
    return (await client.readContract({
      address: quoteAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [pool],
    })) as bigint;
  } catch {
    return 0n;
  }
}

export async function executeTick(
  dossier: ResearchDossier,
  decision: AgentDecision,
  model: string,
): Promise<{
  txHash: Hex;
  action: "PASS" | "BUY_TOKEN";
  reasonHash: Hex;
  blob: ReasonBlob;
  blobUrl: string | null;
}> {
  const wallet = getSepoliaWalletClient();
  const action =
    decision.decision === "BUY" && decision.sizeUsdc > 0 ? "BUY_TOKEN" : "PASS";

  if (action === "PASS") {
    const { blob, hash } = buildReasonBlob(dossier, decision, model);
    // Publish the blob before the on-chain commit so verifiers reading
    // the tx in the same window can already resolve the reasonHash.
    const blobUrl = await publishBlob(hash, blob);
    const txHash = await wallet.writeContract({
      address: LAUNCH_SNIPER_FUND_SEPOLIA,
      abi: LAUNCH_SNIPER_FUND_ABI,
      functionName: "tick",
      args: [ACTION.PASS, dossier.token.address, 0n, 0n, hash],
    });
    return { txHash, action, reasonHash: hash, blob, blobUrl };
  }

  // BUY_TOKEN path: compute the paper fill and refuse to post if the
  // pool can't support it.
  const fill = computePaperFill(dossier, decision.sizeUsdc);
  if (!fill) {
    // Downgrade to PASS with a clear reason on the blob.
    const downgraded: AgentDecision = {
      ...decision,
      decision: "PASS",
      sizeUsdc: 0,
      reason: decision.reason || "fill-unrepresentable",
      reasoning:
        (decision.reasoning ? decision.reasoning + " " : "") +
        "Executor downgraded to PASS: pool uninitialized, WETH-quoted, or zero-price.",
    };
    const { blob, hash } = buildReasonBlob(dossier, downgraded, model);
    const blobUrl = await publishBlob(hash, blob);
    const txHash = await wallet.writeContract({
      address: LAUNCH_SNIPER_FUND_SEPOLIA,
      abi: LAUNCH_SNIPER_FUND_ABI,
      functionName: "tick",
      args: [ACTION.PASS, dossier.token.address, 0n, 0n, hash],
    });
    return { txHash, action: "PASS", reasonHash: hash, blob, blobUrl };
  }

  // Optional pool-depth sanity check.
  const quoteInPool = await quoteBalanceInPool(
    dossier.pool.pool,
    dossier.candidate.quoteAddress,
  );
  if (quoteInPool < fill.quoteAmount) {
    const downgraded: AgentDecision = {
      ...decision,
      decision: "PASS",
      sizeUsdc: 0,
      reason: "pool-too-thin",
      reasoning:
        (decision.reasoning ? decision.reasoning + " " : "") +
        `Executor downgraded: pool quote-side balance ${quoteInPool.toString()} is below intended spend ${fill.quoteAmount.toString()}. Passing.`,
    };
    const { blob, hash } = buildReasonBlob(dossier, downgraded, model);
    const blobUrl = await publishBlob(hash, blob);
    const txHash = await wallet.writeContract({
      address: LAUNCH_SNIPER_FUND_SEPOLIA,
      abi: LAUNCH_SNIPER_FUND_ABI,
      functionName: "tick",
      args: [ACTION.PASS, dossier.token.address, 0n, 0n, hash],
    });
    return { txHash, action: "PASS", reasonHash: hash, blob, blobUrl };
  }

  // Real BUY.
  const paperFill: ReasonBlob["paperFill"] = {
    quote: dossier.candidate.quote,
    quoteAddress: dossier.candidate.quoteAddress,
    quoteAmountIn: fill.quoteAmount.toString(),
    tokenAmountOut: fill.tokenAmount.toString(),
    pricePaidQuotePerToken_1e18:
      dossier.pool.priceQuotePerToken_1e18.toString(),
  };
  const { blob, hash } = buildReasonBlob(dossier, decision, model, paperFill);
  const blobUrl = await publishBlob(hash, blob);
  const txHash = await wallet.writeContract({
    address: LAUNCH_SNIPER_FUND_SEPOLIA,
    abi: LAUNCH_SNIPER_FUND_ABI,
    functionName: "tick",
    args: [
      ACTION.BUY_TOKEN,
      dossier.token.address,
      fill.tokenAmount,
      fill.quoteAmount,
      hash,
    ],
  });
  return { txHash, action: "BUY_TOKEN", reasonHash: hash, blob, blobUrl };
}
