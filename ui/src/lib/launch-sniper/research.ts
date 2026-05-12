/**
 * Token + pool research module.
 *
 * Reads ERC-20 metadata for the candidate token and the live state of the
 * Uniswap V3 pool. The output is the agent's dossier; what the LLM gets
 * to look at before deciding PASS or BUY.
 *
 * Phase 1 keeps the dossier minimal: name/symbol/decimals/totalSupply +
 * pool price + active-range liquidity. Phase 2 adds verified source
 * (Basescan), deployer history, and top-10 holder concentration.
 */

import { type Address } from "viem";
import { ERC20_ABI, UNISWAP_V3_POOL_ABI } from "./abi";
import { getMainnetClient } from "./indexer";
import type { PoolCandidate, PoolState, ResearchDossier, TokenMetadata } from "./types";

async function readTokenMetadata(token: Address): Promise<TokenMetadata> {
  const client = getMainnetClient();
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client
      .readContract({ address: token, abi: ERC20_ABI, functionName: "name" })
      .catch(() => "<unreadable>"),
    client
      .readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" })
      .catch(() => "<unreadable>"),
    client
      .readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" })
      .catch(() => 18),
    client
      .readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "totalSupply",
      })
      .catch(() => 0n),
  ]);
  return {
    address: token,
    name: String(name),
    symbol: String(symbol),
    decimals: Number(decimals),
    totalSupply: totalSupply as bigint,
  };
}

/** Convert sqrtPriceX96 to a price ratio scaled by 1e18.
 *  Price returned is quote/token: how much quote you get for 1 token,
 *  adjusted for decimals.
 *
 *  sqrtPriceX96 represents sqrt(token1/token0) * 2^96 in the pool's
 *  internal numeraire. We do the math carefully in bigint to avoid
 *  precision loss. */
function sqrtPriceToQuotePerToken_1e18(
  sqrtPriceX96: bigint,
  token0: Address,
  token1: Address,
  quoteAddress: Address,
  tokenAddress: Address,
  decimalsToken: number,
  decimalsQuote: number,
): bigint {
  if (sqrtPriceX96 === 0n) return 0n;
  // priceToken1PerToken0 = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
  // Scale up by 1e18 before the divide to keep precision.
  const numerator = sqrtPriceX96 * sqrtPriceX96 * 10n ** 18n;
  const denominator = 2n ** 192n;
  // priceToken1PerToken0Raw is in token1's decimals per (1 raw unit of token0).
  // We want quote/token in human terms, adjusted for both decimals.
  let priceRaw = numerator / denominator;

  const tokenIsToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
  const quoteIsToken1 = token1.toLowerCase() === quoteAddress.toLowerCase();

  if (!(tokenIsToken0 && quoteIsToken1)) {
    // We want quote per token. If token is token0 and quote is token1,
    // priceRaw is already token1/token0 = quote/token (in raw units).
    // Otherwise invert: token/quote needs to become quote/token.
    if (priceRaw === 0n) return 0n;
    priceRaw = (10n ** 36n) / priceRaw;
  }
  // Adjust for decimal difference: quote-side decimals vs token-side.
  // priceRaw is in (quote raw units / 1 token raw unit) * 1e18.
  // human price = priceRaw * 10^(decToken - decQuote)
  const decDiff = decimalsToken - decimalsQuote;
  if (decDiff >= 0) {
    return priceRaw * 10n ** BigInt(decDiff);
  } else {
    return priceRaw / 10n ** BigInt(-decDiff);
  }
}

async function readPoolState(
  candidate: PoolCandidate,
  decimalsToken: number,
): Promise<PoolState> {
  const client = getMainnetClient();
  try {
    const [token0, token1, slot0, liquidity] = await Promise.all([
      client.readContract({
        address: candidate.pool,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: "token0",
      }),
      client.readContract({
        address: candidate.pool,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: "token1",
      }),
      client.readContract({
        address: candidate.pool,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: "slot0",
      }),
      client.readContract({
        address: candidate.pool,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: "liquidity",
      }),
    ]);

    const decimalsQuote = candidate.quote === "USDC" ? 6 : 18;
    const sqrtPriceX96 = (slot0 as readonly bigint[])[0];
    const initialized = sqrtPriceX96 !== 0n;

    const price = initialized
      ? sqrtPriceToQuotePerToken_1e18(
          sqrtPriceX96,
          token0 as Address,
          token1 as Address,
          candidate.quoteAddress,
          candidate.token,
          decimalsToken,
          decimalsQuote,
        )
      : 0n;

    return {
      pool: candidate.pool,
      priceQuotePerToken_1e18: price,
      // viem `liquidity()` returns an L value in sqrt(token0*token1) units;
      // not directly the quote-side $ depth. For Phase 1 we expose it
      // verbatim; the LLM treats large vs small relatively rather than
      // as a dollar number.
      quoteSideLiquidity: liquidity as bigint,
      initialized,
    };
  } catch {
    return {
      pool: candidate.pool,
      priceQuotePerToken_1e18: 0n,
      quoteSideLiquidity: 0n,
      initialized: false,
    };
  }
}

export async function buildDossier(
  candidate: PoolCandidate,
): Promise<ResearchDossier> {
  const token = await readTokenMetadata(candidate.token);
  const pool = await readPoolState(candidate, token.decimals);
  return {
    candidate,
    token,
    pool,
    assembledAt: new Date().toISOString(),
  };
}
