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
    <section className="surface p-5 md:p-6 mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <div>
          <div className="eyebrow mb-1">Live deployment · Base Sepolia</div>
          <h2 className="serif text-xl md:text-2xl tracking-tight">
            The same agent, deployed for real.
          </h2>
        </div>
        <a
          href={basescanAddressUrl(fund.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-[11px] uppercase tracking-wider text-coral hover:underline underline-offset-[3px] break-all"
        >
          {fund.address} ↗
        </a>
      </div>

      {err && (
        <p className="mono text-[11px] text-amber">
          Couldn&apos;t read chain state: {err}
        </p>
      )}

      {!state && !err && (
        <p className="mono text-[11px] text-fg-mute">Reading chain state…</p>
      )}

      {state && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 mb-5">
            <Stat
              label="USDC balance"
              value={`$${usdcHuman.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              sub="held by the fund"
            />
            <Stat
              label="WETH balance"
              value={wethHuman.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}
              sub="held by the fund"
            />
            <Stat
              label="Ticks committed"
              value={state.tickCount.toString()}
              sub={
                state.recentTicks.length > 0
                  ? `last ${ageRel(BigInt(state.recentTicks[0].timestamp))}`
                  : "none yet"
              }
            />
            <Stat
              label="Agent (sole writer)"
              value={`${AGENT_EOA.slice(0, 8)}…${AGENT_EOA.slice(-4)}`}
              sub={
                <a
                  href={basescanAddressUrl(AGENT_EOA)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-coral hover:underline underline-offset-[3px]"
                >
                  on Basescan ↗
                </a>
              }
              isReact
            />
          </div>

          {state.recentTicks.length === 0 ? (
            <p className="text-[13px] text-fg-dim leading-relaxed">
              The fund has been deployed but has not yet ticked. The scenarios
              above are run against mocked state; the live agent runs against
              the real chain once funded with USDC and pointed at a real
              market feed. Phase next.
            </p>
          ) : (
            <div className="border-t border-border pt-4">
              <div className="eyebrow mb-3">
                Most recent ticks · newest first
              </div>
              <ul className="space-y-2">
                {state.recentTicks.map((t) => (
                  <li
                    key={t.index}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12.5px]"
                  >
                    <span className="mono text-fg-mute tnum w-7">
                      #{t.index}
                    </span>
                    <span
                      className={`badge shrink-0 ${
                        t.action === "BUY_WETH"
                          ? "badge-priced"
                          : t.action === "SELL_WETH"
                            ? "badge-stale"
                            : "badge-stale"
                      }`}
                    >
                      {t.action}
                    </span>
                    <span className="mono text-fg-dim">
                      USDC: ${(Number(t.usdcAfter) / 1e6).toFixed(2)} · WETH:{" "}
                      {(Number(t.wethAfter) / 1e18).toFixed(4)}
                    </span>
                    <span className="mono text-fg-mute text-[10.5px]">
                      {ageRel(BigInt(t.timestamp))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  isReact,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  isReact?: boolean;
}) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="serif text-xl md:text-[22px] tnum leading-tight">
        {value}
      </div>
      <div className="mono text-[10.5px] mt-0.5 text-fg-mute">
        {isReact ? sub : sub}
      </div>
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
