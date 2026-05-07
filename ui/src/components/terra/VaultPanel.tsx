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
    <div className="surface p-6 lg:col-span-2">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="eyebrow mb-1">USTD vault</div>
          <div className="serif text-2xl">Algorithmic stablecoin</div>
        </div>
        <span className="badge badge-stale">{presetLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-5">
        <BigStat
          label="Peg"
          value={`$${vault.ustdMedianUsd.toFixed(3)}`}
          sub={`${pegDevBps >= 0 ? "-" : "+"}${Math.abs(pegDevBps).toFixed(0)}bps from $1`}
          health={pegHealth}
        />
        <BigStat
          label="LUND price"
          value={`$${vault.lundPriceUsd.toFixed(2)}`}
          sub={`${(((vault.lundPriceChange24h - 1) * 100) | 0)}% / 24h`}
          health={priceHealth}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
        <Stat
          label="USTD circulating"
          value={`${(vault.ustdSupply / 1e9).toFixed(2)}B`}
        />
        <Stat
          label="LUND circulating"
          value={`${(vault.lundSupply / 1e6).toFixed(0)}M`}
          sub={`${signed(((vault.lundSupplyGrowth24h - 1) * 100))}% / 24h`}
          health={supplyHealth}
        />
        <Stat
          label="Reserves"
          value={`${(vault.reserveCoverage * 100).toFixed(1)}%`}
          sub="of USTD supply"
          health={reserveHealth}
        />
        <Stat
          label="Redemption pressure"
          value={`${(vault.redemptionRate1h * 100).toFixed(2)}%/h`}
          sub={`= ${formatUsd((vault.redemptionRate1h * vault.ustdSupply))} / hour`}
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
  if (h === "crit") return "text-red";
  if (h === "warn") return "text-amber";
  return "text-green";
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
      <div className="eyebrow mb-1">{label}</div>
      <div className="serif text-3xl tnum">{value}</div>
      <div className={`mono text-[11px] mt-0.5 ${healthColor(health)}`}>{sub}</div>
    </div>
  );
}

function Stat({
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
    <div>
      <div className="eyebrow mb-0.5">{label}</div>
      <div className="mono text-sm tnum text-fg">{value}</div>
      {sub && (
        <div className={`mono text-[10px] ${healthColor(health) || "text-fg-mute"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
