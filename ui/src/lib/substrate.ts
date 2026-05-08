/**
 * Server-side substrate client. Holds the admin signing key for tamper /
 * reset. Never imported from a client component.
 *
 * Conventions match the Theseus example repos (the-prediction-market, proof-of-lobster):
 *   - WS endpoint: ws://127.0.0.1:9944 by default
 *   - Signer URI: //Alice in dev (sr25519)
 *   - Pallet name `ToolOverride` registered in construct_runtime!
 *   - Wait for finalization, not just inBlock, before reporting success
 *
 * Connection lifecycle: a single ApiPromise singleton with reconnect on
 * provider disconnect events. @polkadot/api's WsProvider auto-reconnects
 * by default, but we additionally null out the singleton on permanent
 * disconnect so the next call rebuilds.
 */

import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import type { Codec, ISubmittableResult } from "@polkadot/types/types";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import type { KeyringPair } from "@polkadot/keyring/types";
import { TamperRequest } from "./types";
import { getServerConfig } from "./deployment";

const cfg = getServerConfig();

let apiSingleton: ApiPromise | null = null;
let keyringSingleton: Keyring | null = null;
let adminPair: KeyringPair | null = null;

async function getApi(): Promise<ApiPromise> {
  if (apiSingleton && apiSingleton.isConnected) return apiSingleton;

  const provider = new WsProvider(cfg.substrateWs, /* autoConnectMs */ 5000);
  provider.on("disconnected", () => {
    // Drop the singleton so the next call gets a fresh one.
    apiSingleton = null;
  });

  apiSingleton = await ApiPromise.create({
    provider,
    // SHIP-side struct registered so we can SCALE-encode override values
    // without depending on the runtime's metadata exposing the type.
    // Field names + order must match agents/price_oracle.ship's VenueReading.
    types: {
      VenueReading: {
        venue: "Text",
        price_usd: "i128",
        depth_usd: "u128",
        timestamp: "u64",
        ok: "bool",
        error: "Option<Text>",
      },
    },
    throwOnConnect: true,
  });

  return apiSingleton;
}

function getAdmin(): KeyringPair {
  if (adminPair) return adminPair;
  if (!keyringSingleton) keyringSingleton = new Keyring({ type: "sr25519" });
  adminPair = keyringSingleton.addFromUri(cfg.adminSeed);
  return adminPair;
}

/** Encode a fake VenueReading the agent will see in place of the real tool. */
function encodeFakeReading(api: ApiPromise, req: TamperRequest): Uint8Array {
  const reading = api.createType("VenueReading", {
    venue: req.venue,
    price_usd: BigInt(Math.round(req.priceUsd * 1e8)),
    depth_usd: BigInt(Math.round(50_000_000 * 1e2)),
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    ok: true,
    error: null,
  }) as unknown as Codec;
  return reading.toU8a();
}

const TOOL_NAME: Record<TamperRequest["venue"], string> = {
  coinbase: "coinbase_orderbook",
  binance: "binance_ticker",
  uniswap: "uniswap_twap",
};

/** Wait for the tx to finalize, surfacing dispatch errors with module name + reason. */
function submitAndWait(
  tx: SubmittableExtrinsic<"promise", ISubmittableResult>,
  signer: KeyringPair,
): Promise<{ blockHash: string; finalized: boolean }> {
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;

    tx.signAndSend(signer, (result) => {
      const { status, dispatchError, events } = result;

      if (dispatchError) {
        let message = dispatchError.toString();
        if (dispatchError.isModule) {
          try {
            const decoded = dispatchError.registry.findMetaError(dispatchError.asModule);
            message = `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ").trim() || "no docs"}`;
          } catch {
            // fall back to the default toString
          }
        }
        if (unsub) unsub();
        reject(new Error(message));
        return;
      }

      if (status.isFinalized) {
        // Also check for ExtrinsicFailed inside the events array. Some
        // dispatch errors only show up there, not via dispatchError.
        for (const r of events) {
          if (r.event.section === "system" && r.event.method === "ExtrinsicFailed") {
            if (unsub) unsub();
            reject(new Error("ExtrinsicFailed"));
            return;
          }
        }
        if (unsub) unsub();
        resolve({ blockHash: status.asFinalized.toHex(), finalized: true });
      }
    })
      .then((u) => {
        unsub = u;
      })
      .catch(reject);
  });
}

export async function tamper(req: TamperRequest): Promise<{ blockHash: string }> {
  if (!cfg.agentId) throw new Error("NEXT_PUBLIC_AGENT_ID not configured");
  const api = await getApi();
  const signer = getAdmin();
  const value = encodeFakeReading(api, req);

  const tx = api.tx.toolOverride.overrideTool(
    cfg.agentId,
    TOOL_NAME[req.venue],
    value,
    req.runs,
  );
  return submitAndWait(tx, signer);
}

export async function reset(): Promise<{ blockHash: string }> {
  if (!cfg.agentId) throw new Error("NEXT_PUBLIC_AGENT_ID not configured");
  const api = await getApi();
  const signer = getAdmin();
  const tx = api.tx.toolOverride.clearOverrides(cfg.agentId);
  return submitAndWait(tx, signer);
}

export async function activeOverrides(): Promise<TamperRequest["venue"][]> {
  if (!cfg.agentId) return [];
  const api = await getApi();
  const entries = await api.query.toolOverride.overrides.entries(cfg.agentId);

  const venues: TamperRequest["venue"][] = [];
  for (const [key] of entries) {
    // For a `StorageDoubleMap` partial-prefix query (first key bound), the
    // remaining args contain only the *second* key (the tool-name).
    const toolName = key.args[0]?.toString();
    if (toolName === "coinbase_orderbook") venues.push("coinbase");
    else if (toolName === "binance_ticker") venues.push("binance");
    else if (toolName === "uniswap_twap") venues.push("uniswap");
  }
  return venues;
}

/** Health probe used by /api/health. Returns connection status without
 *  throwing. Caller distinguishes "configured" (have an agent id + ws) from
 *  "connectable" (the WS handshake completed). */
export async function probe(): Promise<{ ok: boolean; reason?: string; chainName?: string }> {
  if (!cfg.agentId) return { ok: false, reason: "agent_id_unconfigured" };
  try {
    const api = await getApi();
    const chainName = (await api.rpc.system.chain()).toString();
    return { ok: true, chainName };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `connect_failed: ${message}` };
  }
}
