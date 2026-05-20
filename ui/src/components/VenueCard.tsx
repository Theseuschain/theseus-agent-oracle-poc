"use client";

import { useState } from "react";
import { VenueReading } from "@/lib/types";
import { formatUsd, formatAge } from "@/lib/format";

interface Props {
  reading: VenueReading | null;
  onTamper: (priceUsd: number) => Promise<void>;
  onReset: () => Promise<void>;
  loading?: boolean;
}

const VENUE_LABEL: Record<VenueReading["venue"], string> = {
  coinbase: "coinbase",
  binance: "binance",
  uniswap: "uniswap",
};

const DEPTH_LABEL: Record<VenueReading["venue"], string> = {
  coinbase: "depth",
  binance: "24h vol",
  uniswap: "tvl",
};

export function VenueCard({ reading, onTamper, onReset, loading }: Props) {
  const [busy, setBusy] = useState(false);
  const [tamperOpen, setTamperOpen] = useState(false);
  const venue = reading?.venue ?? "coinbase";
  const isTampered = reading?.tampered ?? false;
  const isHalted = reading?.ok === false;

  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-mono text-fg-mute">{VENUE_LABEL[venue]}</span>
        <span
          className="serif text-[20px] tnum tracking-tight"
          style={{
            color: isHalted
              ? "var(--coral)"
              : isTampered
                ? "var(--coral)"
                : "var(--fg)",
          }}
        >
          {loading || !reading
            ? "…"
            : reading.ok
              ? formatUsd(reading.priceUsd)
              : reading.error ?? "halted"}
        </span>
        <span className="font-mono text-[11px] text-fg-mute tnum">
          {DEPTH_LABEL[venue]}{" "}
          {reading?.depthUsd
            ? formatUsd(reading.depthUsd, { compact: true, decimals: 1 })
            : "–"}
          {" · "}
          {reading ? formatAge(reading.ageSeconds) : "–"}
        </span>
        {!tamperOpen && (
          <button
            type="button"
            onClick={() => (isTampered ? handleReset() : setTamperOpen(true))}
            disabled={busy}
            className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute transition-colors hover:text-fg hover:underline disabled:opacity-30"
          >
            {isTampered ? "reset" : "tamper"}
          </button>
        )}
      </div>
      {tamperOpen && (
        <form
          className="mt-2 flex items-baseline gap-2 text-[12px]"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.target as HTMLFormElement;
            const input = f.elements.namedItem("price") as HTMLInputElement;
            const n = Number(input.value);
            if (!Number.isFinite(n) || n <= 0) return;
            setBusy(true);
            try {
              await onTamper(n);
              setTamperOpen(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="text-fg-mute">$</span>
          <input
            type="text"
            name="price"
            defaultValue="100000"
            inputMode="decimal"
            disabled={busy}
            autoFocus
            className="w-32 border-b border-border bg-transparent font-mono text-[13px] text-fg focus:border-fg focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="text-fg hover:underline disabled:opacity-30"
          >
            tamper →
          </button>
          <button
            type="button"
            onClick={() => setTamperOpen(false)}
            disabled={busy}
            className="text-fg-mute hover:text-fg hover:underline"
          >
            cancel
          </button>
        </form>
      )}
    </div>
  );

  async function handleReset() {
    setBusy(true);
    try {
      await onReset();
    } finally {
      setBusy(false);
    }
  }
}
