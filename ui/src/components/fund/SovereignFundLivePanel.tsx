"use client";

import { useEffect, useState } from "react";
import {
  AGENT_EOA,
  DEPLOYED_CONTRACTS,
  basescanAddressUrl,
} from "@/lib/deployed-contracts";

interface LiveTick {
  index: number;
  action: "HOLD" | "BUY_WETH" | "SELL_WETH";
  amountIn: string;
  amountOut: string;
  usdcAfter: string;
  wethAfter: string;
  reasonHash: string;
  timestamp: string;
}

interface LiveState {
  usdcBalance: string;
  wethBalance: string;
  tickCount: number;
  recentTicks: LiveTick[];
}

const fund = DEPLOYED_CONTRACTS.sovereignFund;

export function SovereignFundLivePanel() {
  const [state, setState] = useState<LiveState | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/agent/fund/live-state")
      .then(async (r) => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        return (await r.json()) as LiveState;
      })
      .then((j) => {
        if (alive) setState(j);
      })
      .catch((e) => {
        if (alive) setErr((e as Error).message);
      });
    return () => {
      alive = false;
    };
  }, []);

  const usdcHuman = state ? Number(state.usdcBalance) / 1e6 : 0;
  const wethHuman = state ? Number(state.wethBalance) / 1e18 : 0;

  return (
    <div>
      <p className="text-[12px] leading-relaxed text-fg-mute">
        The same agent, deployed for real.{" "}
        <a
          href={basescanAddressUrl(fund.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-mute transition-colors hover:text-fg hover:underline break-all"
        >
          {fund.address} ↗
        </a>
      </p>

      {err && (
        <p className="mt-4 font-mono text-[11px]" style={{ color: "var(--coral)" }}>
          Couldn&apos;t read chain state: {err}
        </p>
      )}

      {!state && !err && (
        <p className="mt-4 font-mono text-[11px] text-fg-mute">
          Reading chain state…
        </p>
      )}

      {state && (
        <>
          <div className="mt-5 border-t border-border">
            <Row
              label="USDC balance"
              value={`$${usdcHuman.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              sub="held by the fund"
            />
            <Row
              label="WETH balance"
              value={wethHuman.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}
              sub="held by the fund"
            />
            <Row
              label="Ticks committed"
              value={state.tickCount.toString()}
              sub={
                state.recentTicks.length > 0
                  ? `last ${ageRel(BigInt(state.recentTicks[0].timestamp))}`
                  : "none yet"
              }
            />
            <div className="flex items-baseline justify-between gap-3 border-b border-border py-3 last:border-b-0 text-[13px]">
              <span className="font-mono text-fg-mute">Agent (sole writer)</span>
              <span className="font-mono tnum text-fg">
                {`${AGENT_EOA.slice(0, 8)}…${AGENT_EOA.slice(-4)}`}
              </span>
              <a
                href={basescanAddressUrl(AGENT_EOA)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-fg-mute transition-colors hover:text-fg hover:underline"
              >
                on Basescan ↗
              </a>
            </div>
          </div>

          {state.recentTicks.length === 0 ? (
            <p className="mt-5 text-[12px] leading-relaxed text-fg-mute">
              The fund has been deployed but has not yet ticked. The scenarios
              above are run against mocked state; the live agent runs against
              the real chain once funded with USDC and pointed at a real
              market feed. Phase next.
            </p>
          ) : (
            <div className="mt-6">
              <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                most recent ticks · newest first
              </p>
              <ul>
                {state.recentTicks.map((t) => (
                  <li
                    key={t.index}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border py-3 last:border-b-0 text-[12.5px]"
                  >
                    <span className="font-mono tnum w-7 text-fg-mute">
                      #{t.index}
                    </span>
                    <span
                      className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
                      style={{
                        color:
                          t.action === "HOLD" ? "var(--fg)" : "var(--coral)",
                      }}
                    >
                      {t.action}
                    </span>
                    <span className="font-mono text-fg-mute">
                      USDC: ${(Number(t.usdcAfter) / 1e6).toFixed(2)} · WETH:{" "}
                      {(Number(t.wethAfter) / 1e18).toFixed(4)}
                    </span>
                    <span className="font-mono text-[10.5px] text-fg-mute">
                      {ageRel(BigInt(t.timestamp))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-3 last:border-b-0 text-[13px]">
      <span className="font-mono text-fg-mute">{label}</span>
      <span className="font-mono tnum text-fg">{value}</span>
      {sub && (
        <span className="font-mono text-[11px] text-fg-mute tnum">{sub}</span>
      )}
    </div>
  );
}

function ageRel(timestamp: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
