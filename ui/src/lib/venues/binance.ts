/**
 * Binance 24h ticker reader.
 *
 * Public API, no auth: GET /api/v3/ticker/24hr?symbol=ETHUSDT.
 * Returns lastPrice + quoteVolume (24h $ volume). Volume is a depth proxy:
 * weaker than an order-book read but the agent's reconciliation policy works
 * as long as Coinbase + Binance normally agree to within 50bps.
 */

import { VenueReading } from "../types";
import { failed, ok } from "./types";

// Binance.com is geo-blocked in some regions (incl. parts of the US).
// .us is the US-compliant domain and the closest functional equivalent.
const ENDPOINTS = [
  "https://api.binance.com/api/v3/ticker/24hr",
  "https://api.binance.us/api/v3/ticker/24hr",
];
const TIMEOUT_MS = 4_000;

interface TickerResponse {
  symbol: string;
  lastPrice: string;
  quoteVolume: string;
  closeTime: number;
}

export async function binanceTicker(symbol: string): Promise<VenueReading> {
  let lastError = "no_endpoint_responded";
  for (const base of ENDPOINTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base}?symbol=${encodeURIComponent(symbol)}`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        // 451 / 403 from a region-blocked endpoint; try the next.
        lastError = `http ${res.status}`;
        continue;
      }
      const body = (await res.json()) as TickerResponse;
      const price = parseFloat(body.lastPrice);
      if (!Number.isFinite(price) || price <= 0) {
        return failed("binance", "zero_price");
      }
      const volume = parseFloat(body.quoteVolume);
      if (!Number.isFinite(volume) || volume <= 0) {
        return failed("binance", "bad_volume");
      }
      const ts = Math.floor(body.closeTime / 1000);
      return ok("binance", price, volume, ts);
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(timer);
    }
  }
  return failed("binance", lastError);
}
