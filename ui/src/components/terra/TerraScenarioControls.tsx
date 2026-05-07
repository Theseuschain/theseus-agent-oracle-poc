"use client";

import { useState } from "react";
import { Brain, Cog, FastForward, RotateCcw } from "lucide-react";
import { PRESETS } from "@/lib/terra-scenario";

type AgentMode = "rule" | "deepseek";

interface Props {
  agentMode: AgentMode;
  agentPending: boolean;
  presetLabel: string;
  onAgentModeChange: (m: AgentMode) => void;
  onPreset: (key: keyof typeof PRESETS) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}

const ORDER: (keyof typeof PRESETS)[] = ["healthy", "wobble", "cracking", "bankRun", "spiral"];

export function TerraScenarioControls({
  agentMode,
  agentPending,
  presetLabel,
  onAgentModeChange,
  onPreset,
  onReset,
}: Props) {
  const [busy, setBusy] = useState(false);
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
              active={agentMode === "deepseek"}
              disabled={disabled}
              onClick={() => onAgentModeChange("deepseek")}
              icon={<Brain size={10} />}
              label="Agent"
            />
            <ModeChip
              active={agentMode === "rule"}
              disabled={disabled}
              onClick={() => onAgentModeChange("rule")}
              icon={<Cog size={10} />}
              label="Rules"
            />
          </div>
          <button
            className="btn"
            onClick={() => wrap(onReset)}
            disabled={disabled}
            title="Reset to healthy state"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      <div className="rounded-[10px] bg-surface-2 border border-border p-4">
        <div className="eyebrow mb-2">Step through Terra: May 8–12, 2022</div>
        <p className="text-xs text-fg-dim leading-relaxed mb-3">
          Each preset puts the vault in a state that matches a day of the actual
          Terra/Luna collapse. After loading a preset, try Mint or Redeem and
          watch the failsafe agent decide.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {ORDER.map((key) => {
            const p = PRESETS[key];
            const active = presetLabel === p.label;
            return (
              <button
                key={key}
                className={`rounded-[8px] border transition px-3 py-2.5 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                  active
                    ? "bg-coral/10 border-coral text-fg"
                    : "bg-bg border-border hover:border-coral text-fg"
                }`}
                onClick={() => wrap(() => onPreset(key))}
                disabled={disabled}
              >
                <div className="flex items-center gap-1.5 mono text-[11px] uppercase tracking-wider">
                  <FastForward size={11} /> {p.label}
                </div>
                <div className="mono text-[10px] text-fg-mute mt-0.5 leading-snug">
                  {p.description.split(".")[0]}
                </div>
              </button>
            );
          })}
        </div>
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
