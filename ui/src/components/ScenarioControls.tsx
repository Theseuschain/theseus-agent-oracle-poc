"use client";

import { useState } from "react";
import { Zap, ZapOff, Power, Brain, Cog, Activity, TrendingDown, FlaskConical } from "lucide-react";
import { VenueReading } from "@/lib/types";
import { AgentMode } from "@/lib/mock-scenario";

type Venue = VenueReading["venue"];

interface Props {
  haltedVenues: Venue[];
  anyOverride: boolean;
  agentMode: AgentMode;
  agentPending: boolean;
  onAgentModeChange: (mode: AgentMode) => void;
  onPumpAll: (priceUsd: number) => Promise<void> | void;
  onHaltToggle: (venue: Venue) => Promise<void> | void;
  onResetAll: () => Promise<void> | void;
  onBlackSwan: (kind: "depth-collapse" | "subtle-pump" | "flash-crash") => Promise<void> | void;
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
  agentMode,
  agentPending,
  onAgentModeChange,
  onPumpAll,
  onHaltToggle,
  onResetAll,
  onBlackSwan,
}: Props) {
  const [pumpOpen, setPumpOpen] = useState(false);
  const [pumpValue, setPumpValue] = useState("100000");
  const [busy, setBusy] = useState(false);

  const haltedSet = new Set(haltedVenues);
  const dirty = anyOverride || haltedSet.size > 0;
  const disabled = busy || agentPending;

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
      {/* Header row: title + agent mode toggle + reset */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="eyebrow">Demo levers</div>
        <div className="flex items-center gap-3 flex-wrap">
          {agentPending && (
            <span className="mono text-[10px] text-coral pulse-coral rounded-full px-2 py-0.5 border border-coral/40">
              reasoning…
            </span>
          )}
          <div className="flex gap-0.5 p-0.5 rounded-[8px] bg-bg border border-border">
            <ModeChip
              active={agentMode === "rule"}
              disabled={disabled}
              onClick={() => onAgentModeChange("rule")}
              icon={<Cog size={10} />}
              label="Rules"
            />
            <ModeChip
              active={agentMode === "deepseek"}
              disabled={disabled}
              onClick={() => onAgentModeChange("deepseek")}
              icon={<Brain size={10} />}
              label="Agent"
            />
          </div>
          {dirty && (
            <button className="btn" onClick={() => wrap(onResetAll)} disabled={disabled}>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout: manipulation on left, scenarios on right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Manipulation tools */}
        <div className="rounded-[10px] bg-surface-2 border border-border p-4 space-y-3">
          <div className="eyebrow">Manipulation</div>

          {/* Pump all venues */}
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
                  disabled={disabled}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={disabled}>
                {busy ? "..." : "Pump"}
              </button>
              <button type="button" className="btn" onClick={() => setPumpOpen(false)} disabled={disabled}>
                Cancel
              </button>
            </form>
          ) : (
            <button
              className="btn btn-primary w-full justify-center"
              onClick={() => setPumpOpen(true)}
              disabled={disabled}
              title="Set every venue's price to the same fake value (Mango shape)"
            >
              <Zap size={13} /> Pump all venues
            </button>
          )}

          {/* Halt toggles */}
          <div>
            <div className="mono text-[10px] text-fg-mute mb-1.5">Halt a venue</div>
            <div className="grid grid-cols-3 gap-2">
              {VENUES.map((v) => {
                const halted = haltedSet.has(v);
                return (
                  <button
                    key={v}
                    className={`btn w-full justify-center ${halted ? "btn-danger" : ""}`}
                    onClick={() => wrap(() => onHaltToggle(v))}
                    disabled={disabled}
                  >
                    {halted ? <ZapOff size={12} /> : <Power size={12} />}
                    {LABEL[v]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scenario presets */}
        <div className="rounded-[10px] bg-surface-2 border border-border p-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="eyebrow">Scenarios</div>
            {agentMode === "rule" && (
              <span className="mono text-[10px] text-fg-mute">switch to Agent for these</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <ScenarioButton
              icon={<Activity size={12} />}
              label="Depth collapse"
              sub="prices unchanged, depth drops to 5%"
              onClick={() => wrap(() => onBlackSwan("depth-collapse"))}
              disabled={disabled}
            />
            <ScenarioButton
              icon={<TrendingDown size={12} />}
              label="49% pump"
              sub="just under the rule threshold"
              onClick={() => wrap(() => onBlackSwan("subtle-pump"))}
              disabled={disabled}
            />
            <ScenarioButton
              icon={<FlaskConical size={12} />}
              label="Flash crash"
              sub="real 30% drop. agent should price"
              onClick={() => wrap(() => onBlackSwan("flash-crash"))}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-fg-mute">
        Tamper a single venue from its card below.
      </div>
    </div>
  );
}

function ModeChip({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      className={`mono text-[11px] py-1 px-2.5 rounded-[6px] flex items-center gap-1.5 transition ${
        active ? "bg-coral text-bg" : "text-fg-dim hover:text-fg"
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {label}
    </button>
  );
}

function ScenarioButton({
  icon,
  label,
  sub,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      className="rounded-[8px] bg-bg border border-border hover:border-coral disabled:opacity-50 disabled:cursor-not-allowed transition px-3 py-2.5 text-left"
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-wider text-fg">
        {icon}
        {label}
      </div>
      <div className="mono text-[10px] text-fg-mute mt-0.5">{sub}</div>
    </button>
  );
}
