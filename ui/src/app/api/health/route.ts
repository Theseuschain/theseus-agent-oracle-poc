import { NextResponse } from "next/server";
import { ADDRESSES, publicClient } from "@/lib/chain";
import { hasLiveDeployment, getServerConfig } from "@/lib/deployment";

export const dynamic = "force-dynamic";

/**
 * Reports whether the EVM RPC and substrate WS are reachable + which
 * deployment artifacts are configured. The header in the UI uses this to
 * show "live chain ✓" vs "live chain (substrate disconnected)" vs "mock data".
 */
export async function GET() {
  const cfg = getServerConfig();
  const live = hasLiveDeployment(cfg);

  if (!live) {
    return NextResponse.json({ mode: "mock", live: false });
  }

  const evmCheck = (async () => {
    try {
      const id = await publicClient.getChainId();
      return { ok: true, chainId: id };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  })();

  const wsCheck = (async () => {
    try {
      // Lazy-import so the heavy @polkadot/api bundle isn't loaded for
      // pure-EVM hits.
      const { probe } = await import("@/lib/substrate");
      return await probe();
    } catch (e: unknown) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
  })();

  const [evm, ws] = await Promise.all([evmCheck, wsCheck]);

  return NextResponse.json({
    mode: "live",
    live: true,
    evm,
    ws,
    addresses: {
      agentPriceFeed: ADDRESSES.feed ?? null,
      pool: ADDRESSES.pool ?? null,
      weth: ADDRESSES.weth ?? null,
      usdc: ADDRESSES.usdc ?? null,
      agentId: cfg.agentId ?? null,
    },
  });
}
