"use client";

import { useState } from "react";
import { Zap, ZapOff, AlertOctagon, Power } from "lucide-react";
import { VenueReading } from "@/lib/types";

type Venue = VenueReading["venue"];

interface Props {
  haltedVenues: Venue[];
  anyOverride: boolean;
  onPumpAll: (priceUsd: number) => Promise<void> | void;
  onHaltToggle: (venue: Venue) => Promise<void> | void;
  onResetAll: () => Promise<void> | void;
}

const VENUES: Venue[] = ["coinbase", "binance", "uniswap"];
const LABEL: Record<Venue, string> = {
  coinbase: "Coinbase",
  binance: "Binance",
  uniswap: "Uniswap",
};

export function ScenarioControls({
  haltedVenues,
  anyOverride,
  onPumpAll,
  onHaltToggle,
  onResetAll,
}: Props) {
  const [pumpOpen, setPumpOpen] = useState(false);
  const [pumpValue, setPumpValue] = useState("100000");
  const [busy, setBusy] = useState(false);

  const haltedSet = new Set(haltedVenues);
  const dirty = anyOverride || haltedSet.size > 0;

  const wrap = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="eyebrow mb-1">Demo levers</div>
          <div className="text-sm text-fg-dim leading-snug max-w-xl">
            Three structurally distinct attack shapes. Each triggers a refusal a
            naïve oracle contract <em>cannot</em> reproduce.
          </div>
        </div>
        {dirty && (
          <button
            className="btn"
            onClick={() => wrap(onResetAll)}
            disabled={busy}
            title="Clear all overrides + halts"
          >
            Reset all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Pump all venues — Mango shape */}
        <div className="rounded-[10px] bg-surface-2 border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertOctagon size={14} className="text-coral" />
            <span className="mono text-[11px] uppercase tracking-wider text-fg">
              Mango-shape attack
            </span>
          </div>
          <p className="text-xs text-fg-dim leading-relaxed mb-3">
            Pump <em>all three venues</em> to the same manipulated price. No
            numerical divergence. A venue-quorum contract sees agreement and
            prices it. The agent reasons about depth + baseline deviation.
          </p>
          {pumpOpen ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(pumpValue);
                if (!Number.isFinite(n) || n <= 0) return;
                wrap(async () => {
                  await onPumpAll(n);
                  setPumpOpen(false);
                });
              }}
            >
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-dim mono text-sm pointer-events-none">$</span>
                <input
                  type="text"
                  value={pumpValue}
                  inputMode="decimal"
                  onChange={(e) => setPumpValue(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 mono text-sm rounded-[8px] bg-bg border border-border focus:outline-none focus:border-coral"
                  autoFocus
                  disabled={busy}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "..." : "Pump"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setPumpOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              className="btn btn-primary w-full justify-center"
              onClick={() => setPumpOpen(true)}
              disabled={busy}
            >
              <Zap size={13} /> Pump all venues
            </button>
          )}
        </div>

        {/* Halt context */}
        <div className="rounded-[10px] bg-surface-2 border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Power size={14} className="text-coral" />
            <span className="mono text-[11px] uppercase tracking-wider text-fg">
              Off-chain context event
            </span>
          </div>
          <p className="text-xs text-fg-dim leading-relaxed mb-3">
            Mark a venue as <em>halted</em> via a status-page event. The agent
            reads the world; a contract reading a Chainlink feed has no API for
            this.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {VENUES.map((v) => {
              const halted = haltedSet.has(v);
              return (
                <button
                  key={v}
                  className={`btn w-full justify-center ${halted ? "btn-danger" : ""}`}
                  onClick={() => wrap(() => onHaltToggle(v))}
                  disabled={busy}
                >
                  {halted ? <ZapOff size={12} /> : <Power size={12} />}
                  {LABEL[v]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-fg-mute">
        The third path — <em>tampering one venue</em> — lives on each venue
        card below. Numerical divergence is the table-stakes attack a
        rule-based contract <em>can</em> catch.
      </div>
    </div>
  );
}
