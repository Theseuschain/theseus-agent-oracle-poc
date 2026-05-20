"use client";

import { useState } from "react";
import { VenueReading } from "@/lib/types";

type Venue = VenueReading["venue"];

interface Props {
  haltedVenues: Venue[];
  anyOverride: boolean;
  agentPending: boolean;
  onPumpAll: (priceUsd: number) => Promise<void> | void;
  onHaltToggle: (venue: Venue) => Promise<void> | void;
  onResetAll: () => Promise<void> | void;
  onBlackSwan: (
    kind: "depth-collapse" | "subtle-pump" | "flash-crash",
  ) => Promise<void> | void;
}

const VENUES: Venue[] = ["coinbase", "binance", "uniswap"];

export function ScenarioControls({
  haltedVenues,
  anyOverride,
  agentPending,
  onPumpAll,
  onHaltToggle,
  onResetAll,
  onBlackSwan,
}: Props) {
  const [busy, setBusy] = useState(false);
  const haltedSet = new Set(haltedVenues);
  const dirty = anyOverride || haltedSet.size > 0;
  const disabled = busy || agentPending;

  const wrap = (fn: () => Promise<void> | void) => async () => {
    if (disabled) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const links: { label: string; onClick: () => void | Promise<void> }[] = [
    { label: "pump all to $100k", onClick: wrap(() => onPumpAll(100_000)) },
    ...VENUES.map((v) => ({
      label: (haltedSet.has(v) ? "unhalt " : "halt ") + v,
      onClick: wrap(() => onHaltToggle(v)),
    })),
    { label: "depth collapse", onClick: wrap(() => onBlackSwan("depth-collapse")) },
    { label: "49% pump", onClick: wrap(() => onBlackSwan("subtle-pump")) },
    { label: "flash crash", onClick: wrap(() => onBlackSwan("flash-crash")) },
  ];

  return (
    <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[12px]">
      <span className="text-fg-mute">try a manipulation:</span>
      {links.map((l, i) => (
        <span key={l.label}>
          <button
            type="button"
            onClick={l.onClick}
            disabled={disabled}
            className="italic underline decoration-border underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg disabled:opacity-30 disabled:hover:no-underline"
          >
            {l.label}
          </button>
          {i < links.length - 1 && (
            <span className="ml-4 text-border">·</span>
          )}
        </span>
      ))}
      {dirty && (
        <button
          type="button"
          onClick={wrap(onResetAll)}
          disabled={disabled}
          className="ml-auto text-fg-mute transition-colors hover:text-fg hover:underline disabled:opacity-30"
        >
          reset →
        </button>
      )}
      {agentPending && (
        <span
          className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.16em]"
          style={{ color: "var(--coral)" }}
        >
          agent reasoning…
        </span>
      )}
    </div>
  );
}
