"use client";

import {
  COST_BASIS_USD,
  DEPLOY_PRICE_USD,
  FundPortfolio,
  MarketSnapshot,
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
  const pnlPct = ((nav - COST_BASIS_USD) / COST_BASIS_USD) * 100;
  const usdcPct = usdcWeight(portfolio, market.wethPriceUsd) * 100;
  const wethPct = 100 - usdcPct;
  const priceMovedFromDeploy =
    Math.abs(market.wethPriceUsd - DEPLOY_PRICE_USD) > 0.01;
  const allocationNote =
    usdcPct < 30
      ? "below mandate floor (30% USDC)"
      : wethPct > 60
        ? "above mandate ceiling (60% WETH)"
        : priceMovedFromDeploy
          ? "within mandate range (marked to current price)"
          : "within mandate range";

  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        on-chain portfolio · {presetLabel}
      </p>

      <div className="mt-2 flex items-baseline gap-5">
        <span
          className="serif text-5xl md:text-6xl tnum tracking-tight"
          style={{ color: "var(--fg)" }}
        >
          ${nav.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.18em]"
          style={{
            color: pnlPct >= -1 ? "var(--fg-mute)" : "var(--coral)",
          }}
        >
          {pnlPct >= 0 ? "+" : ""}
          {pnlPct.toFixed(2)}% vs cost basis
        </span>
      </div>

      <p className="mt-3 font-mono text-[10.5px] text-fg-mute">
        {usdcPct.toFixed(0)}% USDC · {wethPct.toFixed(0)}% WETH · {allocationNote}
      </p>

      <div className="mt-6 border-t border-border">
        <Row label="USDC" value={portfolio.usdc.toLocaleString(undefined, { maximumFractionDigits: 0 })} sub={`${usdcPct.toFixed(1)}% of NAV`} />
        <Row
          label="WETH"
          value={portfolio.weth.toFixed(2)}
          sub={`≈ $${(portfolio.weth * market.wethPriceUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })} (${wethPct.toFixed(1)}% of NAV)`}
        />
        <Row
          label="WETH / USDC"
          value={`$${market.wethPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          sub="venue mid"
        />
        <Row
          label="24h return"
          value={`${(market.ret24h - 1) * 100 >= 0 ? "+" : ""}${(((market.ret24h - 1) * 100)).toFixed(2)}%`}
          sub={
            market.ret24h >= 1
              ? "up"
              : market.ret24h >= 0.95
                ? "soft"
                : "drawdown"
          }
        />
        <Row
          label="7d return"
          value={`${(market.ret7d - 1) * 100 >= 0 ? "+" : ""}${(((market.ret7d - 1) * 100)).toFixed(2)}%`}
        />
        <Row
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
        <p className="mt-4 text-[12px] italic leading-relaxed text-fg-mute">
          &ldquo;{market.macroNote}&rdquo;
        </p>
      )}

      <details className="mt-6 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <summary className="cursor-pointer text-[10.5px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg">
          mandate (frozen at deploy) ↓
        </summary>
        <p className="mt-3 text-[12px] leading-relaxed text-fg-mute">
          Preserve capital first, capture upside second. Baseline 50-50
          USDC/WETH. Tilt to as much as 70% USDC in defensive regimes (high
          vol, drawdowns, macro stress). Tilt to as much as 60% WETH in
          trending regimes. Never below 30% USDC. Never above 60% WETH. Skip
          rebalances below ~5% of NAV to avoid churn.
        </p>
      </details>
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
