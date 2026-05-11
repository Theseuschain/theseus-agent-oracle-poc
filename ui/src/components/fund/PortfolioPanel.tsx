"use client";

import {
  FundPortfolio,
  MarketSnapshot,
  STARTING_PORTFOLIO,
  navUsd,
  usdcWeight,
} from "@/lib/fund-scenario";

interface Props {
  portfolio: FundPortfolio;
  market: MarketSnapshot;
  presetLabel: string;
}

export function PortfolioPanel({ portfolio, market, presetLabel }: Props) {
  const nav = navUsd(portfolio, market.wethPriceUsd);
  const startingNav = navUsd(STARTING_PORTFOLIO, market.wethPriceUsd);
  const pnlPct = startingNav > 0 ? ((nav / startingNav) - 1) * 100 : 0;
  const usdcPct = usdcWeight(portfolio, market.wethPriceUsd) * 100;
  const wethPct = 100 - usdcPct;

  return (
    <div className="surface p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="eyebrow mb-1">Sovereign fund</div>
          <div className="serif text-2xl">On-chain portfolio</div>
        </div>
        <span className="badge badge-stale">{presetLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-5">
        <BigStat
          label="NAV"
          value={`$${nav.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub={`PnL ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% vs start at current price`}
          tone={pnlPct >= 0 ? "ok" : "warn"}
        />
        <BigStat
          label="Allocation"
          value={`${usdcPct.toFixed(0)}% USDC / ${wethPct.toFixed(0)}% WETH`}
          sub={
            usdcPct < 30
              ? "below mandate floor (30% USDC)"
              : wethPct > 60
                ? "above mandate ceiling (60% WETH)"
                : "within mandate range"
          }
          tone={usdcPct < 30 || wethPct > 60 ? "crit" : "ok"}
        />
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs mb-5">
        <Stat
          label="USDC"
          value={portfolio.usdc.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}
          sub={`${usdcPct.toFixed(1)}% of NAV`}
        />
        <Stat
          label="WETH"
          value={portfolio.weth.toFixed(2)}
          sub={`≈ $${(portfolio.weth * market.wethPriceUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })} (${wethPct.toFixed(1)}% of NAV)`}
        />
      </div>

      <div className="mb-4">
        <div className="eyebrow mb-2">Market snapshot the agent reads</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-xs">
          <Stat
            label="WETH/USDC"
            value={`$${market.wethPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          />
          <Stat
            label="24h return"
            value={`${((market.ret24h - 1) * 100 >= 0 ? "+" : "")}${(((market.ret24h - 1) * 100)).toFixed(2)}%`}
            sub={
              market.ret24h >= 1
                ? "up"
                : market.ret24h >= 0.95
                  ? "soft"
                  : "drawdown"
            }
          />
          <Stat
            label="7d return"
            value={`${((market.ret7d - 1) * 100 >= 0 ? "+" : "")}${(((market.ret7d - 1) * 100)).toFixed(2)}%`}
          />
          <Stat
            label="Realized vol"
            value={`${market.realizedVolPct.toFixed(0)}%`}
            sub={
              market.realizedVolPct > 80
                ? "regime change"
                : market.realizedVolPct > 35
                  ? "elevated"
                  : "normal"
            }
          />
        </div>
        {market.macroNote && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-fg-dim italic">
            &ldquo;{market.macroNote}&rdquo;
          </p>
        )}
      </div>

      <div className="rounded-[8px] border border-border bg-surface-2 p-3">
        <div className="eyebrow mb-1.5">Mandate (frozen at deploy)</div>
        <p className="text-[12px] leading-relaxed text-fg-dim">
          Preserve capital first, capture upside second. Baseline 50-50
          USDC/WETH. Tilt to as much as 70% USDC in defensive regimes (high
          vol, drawdowns, macro stress). Tilt to as much as 60% WETH in
          trending regimes. Never below 30% USDC. Never above 60% WETH. Skip
          rebalances below ~5% of NAV to avoid churn.
        </p>
      </div>
    </div>
  );
}

type Tone = "ok" | "warn" | "crit";

function toneColor(t?: Tone): string {
  if (t === "crit") return "text-red";
  if (t === "warn") return "text-amber";
  return "text-green";
}

function BigStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
}) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="serif text-3xl tnum">{value}</div>
      <div className={`mono text-[11px] mt-0.5 ${toneColor(tone)}`}>{sub}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="eyebrow mb-0.5">{label}</div>
      <div className="mono text-sm tnum text-fg">{value}</div>
      {sub && <div className="mono text-[10px] text-fg-mute">{sub}</div>}
    </div>
  );
}
