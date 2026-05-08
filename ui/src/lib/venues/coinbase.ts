/**
 * Coinbase order book reader.
 *
 * Public API, no auth: GET /products/{symbol}/book?level=2.
 * level=2 returns aggregated bids/asks; sufficient for a depth calc.
 *
 * Mirrors the Rust impl at tools/src/coinbase_orderbook.rs so the UI shows
 * the same numbers the agent would see.
 */

import { VenueReading } from "../types";
import { failed, ok } from "./types";

const BASE_URL = "https://api.exchange.coinbase.com";
const DEPTH_BPS = 50;
const TIMEOUT_MS = 4_000;

interface BookResponse {
  bids: [string, string, number][];
  asks: [string, string, number][];
}

export async function coinbaseOrderbook(symbol: string): Promise<VenueReading> {
  const url = `${BASE_URL}/products/${encodeURIComponent(symbol)}/book?level=2`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "theseus-agent-oracle-demo/1" },
      cache: "no-store",
    });
    if (!res.ok) return failed("coinbase", `http ${res.status}`);
    const body = (await res.json()) as BookResponse;

    const bids = parseLevels(body.bids);
    const asks = parseLevels(body.asks);
    if (!bids.length || !asks.length) return failed("coinbase", "empty_book");

    const bestBid = bids[0][0];
    const bestAsk = asks[0][0];
    if (bestAsk <= bestBid) return failed("coinbase", "crossed_book");

    const mid = (bestBid + bestAsk) / 2;
    const halfWindow = (mid * DEPTH_BPS) / 10_000;

    let bidDepth = 0;
    for (const [p, sz] of bids) {
      if (p < mid - halfWindow) break;
      bidDepth += p * sz;
    }
    let askDepth = 0;
    for (const [p, sz] of asks) {
      if (p > mid + halfWindow) break;
      askDepth += p * sz;
    }

    return ok("coinbase", mid, bidDepth + askDepth);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("aborted")) return failed("coinbase", "timeout");
    return failed("coinbase", msg);
  } finally {
    clearTimeout(timer);
  }
}

function parseLevels(raw: BookResponse["bids"]): [number, number][] {
  return raw
    .map(([p, sz]) => [parseFloat(p), parseFloat(sz)] as [number, number])
    .filter(([p, sz]) => Number.isFinite(p) && Number.isFinite(sz) && p > 0 && sz > 0);
}
