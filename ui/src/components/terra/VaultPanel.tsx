"use client";

import { VaultState } from "@/lib/terra-scenario";
import { formatUsd } from "@/lib/format";

interface Props {
  vault: VaultState;
  presetLabel: string;
}

export function VaultPanel({ vault, presetLabel }: Props) {
  const pegDevBps = (1 - vault.ustdMedianUsd) * 10_000;
  const pegHealth = healthLevel(pegDevBps, [50, 200]);
  const redemptionHealth = healthLevel(vault.redemptionRate1h, [0.005, 0.02]);
  const supplyHealth = healthLevel(vault.lundSupplyGrowth24h - 1, [0.05, 0.3]);
  const priceHealth = healthLevel(1 - vault.lundPriceChange24h, [0.1, 0.4]);
  const reserveHealth = healthLevel(0.4 - vault.reserveCoverage, [0.0, 0.2]); // inverted

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
          USTD vault · algorithmic stablecoin
        </p>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
          {presetLabel}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
        <BigStat
          label="peg"
          value={`$${vault.ustdMedianUsd.toFixed(3)}`}
          sub={`${pegDevBps >= 0 ? "-" : "+"}${Math.abs(pegDevBps).toFixed(0)}bps from $1`}
          health={pegHealth}
        />
        <BigStat
          label="LUND price"
          value={`$${vault.lundPriceUsd.toFixed(2)}`}
          sub={`${signed(((vault.lundPriceChange24h - 1) * 100))}% / 24h`}
          health={priceHealth}
        />
      </div>

      <div className="mt-5 border-t border-border">
        <Row
          label="USTD circulating"
          value={`${(vault.ustdSupply / 1e9).toFixed(2)}B`}
        />
        <Row
          label="LUND circulating"
          value={`${(vault.lundSupply / 1e6).toFixed(0)}M`}
          sub={`${signed(((vault.lundSupplyGrowth24h - 1) * 100))}% / 24h`}
          health={supplyHealth}
        />
        <Row
          label="reserves"
          value={`${(vault.reserveCoverage * 100).toFixed(1)}%`}
          sub="of USTD supply"
          health={reserveHealth}
        />
        <Row
          label="redemption pressure"
          value={`${(vault.redemptionRate1h * 100).toFixed(2)}%/h`}
          sub={`${formatUsd((vault.redemptionRate1h * vault.ustdSupply))} / hour`}
          health={redemptionHealth}
        />
      </div>
    </div>
  );
}

type Health = "ok" | "warn" | "crit";

function healthLevel(value: number, [warn, crit]: [number, number]): Health {
  if (value >= crit) return "crit";
  if (value >= warn) return "warn";
  return "ok";
}

function healthColor(h?: Health): string {
  if (h === "crit") return "var(--coral)";
  if (h === "warn") return "var(--coral)";
  return "var(--fg-mute)";
}

function signed(n: number): string {
  return n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
}

function BigStat({
  label,
  value,
  sub,
  health,
}: {
  label: string;
  value: string;
  sub: string;
  health: Health;
}) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        {label}
      </p>
      <p
        className="serif text-3xl tnum tracking-tight"
        style={{ color: health === "crit" ? "var(--coral)" : "var(--fg)" }}
      >
        {value}
      </p>
      <p
        className="font-mono text-[10.5px] tnum"
        style={{ color: healthColor(health) }}
      >
        {sub}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  health,
}: {
  label: string;
  value: string;
  sub?: string;
  health?: Health;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0 text-[12px]">
      <span className="font-mono text-fg-mute">{label}</span>
      <span className="flex items-baseline gap-3">
        <span className="font-mono tnum text-fg">{value}</span>
        {sub && (
          <span
            className="font-mono text-[10.5px] tnum"
            style={{ color: healthColor(health) }}
          >
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}
