"use client";

import { useState } from "react";
import { VenueReading } from "@/lib/types";
import { formatUsd, formatAge } from "@/lib/format";
import { Zap, RotateCcw, Power } from "lucide-react";

interface Props {
  reading: VenueReading | null;
  onTamper: (priceUsd: number) => Promise<void>;
  onReset: () => Promise<void>;
  loading?: boolean;
}

const VENUE_LABEL: Record<VenueReading["venue"], string> = {
  coinbase: "Coinbase",
  binance: "Binance",
  uniswap: "Uniswap V3",
};

const VENUE_DETAIL: Record<VenueReading["venue"], string> = {
  coinbase: "ETH-USD · order book",
  binance: "ETHUSDT · 24h ticker",
  uniswap: "WETH/USDC · 30m TWAP",
};

const DEPTH_LABEL: Record<VenueReading["venue"], string> = {
  coinbase: "Depth ±50bps",
  binance: "24h volume",
  uniswap: "Pool TVL",
};

export function VenueCard({ reading, onTamper, onReset, loading }: Props) {
  const [busy, setBusy] = useState(false);
  const [tamperOpen, setTamperOpen] = useState(false);

  const venue = reading?.venue ?? "coinbase";
  const isTampered = reading?.tampered ?? false;
  const isHalted = reading?.ok === false;

  return (
    <div
      className={`surface p-6 ${isTampered || isHalted ? "border-red/40" : "surface-hover"}`}
      style={isTampered || isHalted ? { borderColor: "rgba(255,77,77,0.45)" } : undefined}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-fg text-base font-medium">{VENUE_LABEL[venue]}</div>
          <div className="eyebrow mt-1">{VENUE_DETAIL[venue]}</div>
        </div>
        {isHalted ? (
          <span className="badge badge-tampered">
            <Power size={11} /> halted
          </span>
        ) : isTampered ? (
          <span className="badge badge-tampered">
            <Zap size={11} /> tampered
          </span>
        ) : null}
      </div>

      <div className="serif text-3xl tnum mb-1">
        {loading || !reading ? (
          <span className="text-fg-mute">...</span>
        ) : reading.ok ? (
          formatUsd(reading.priceUsd)
        ) : (
          <span className="text-amber text-base mono">
            {reading.error ?? "unavailable"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-fg-dim mono mb-5">
        <span>
          {DEPTH_LABEL[venue]}{" "}
          <span className="text-fg tnum">
            {reading?.depthUsd ? formatUsd(reading.depthUsd, { compact: true, decimals: 1 }) : "—"}
          </span>
        </span>
        <span>·</span>
        <span>{reading ? formatAge(reading.ageSeconds) : "—"}</span>
      </div>

      {tamperOpen ? (
        <TamperForm
          busy={busy}
          onCancel={() => setTamperOpen(false)}
          onSubmit={async (price) => {
            setBusy(true);
            try {
              await onTamper(price);
              setTamperOpen(false);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <div className="flex gap-2">
          {isTampered ? (
            <button
              className="btn btn-danger flex-1"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onReset();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RotateCcw size={13} /> Reset
            </button>
          ) : (
            <button
              className="btn flex-1"
              disabled={busy}
              onClick={() => setTamperOpen(true)}
            >
              <Zap size={13} /> Tamper
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TamperForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (price: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("100000");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return;
        onSubmit(n);
      }}
    >
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-dim mono text-sm pointer-events-none">$</span>
        <input
          type="text"
          value={value}
          inputMode="decimal"
          onChange={(e) => setValue(e.target.value)}
          className="w-full pl-7 pr-3 py-2 mono text-sm rounded-[10px] bg-surface-2 border border-border focus:outline-none focus:border-coral"
          autoFocus
          disabled={busy}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "..." : "Submit"}
      </button>
      <button type="button" className="btn" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </form>
  );
}
