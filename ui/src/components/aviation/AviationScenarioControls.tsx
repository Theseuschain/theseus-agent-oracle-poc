"use client";

import { useState } from "react";
import { FastForward, RotateCcw } from "lucide-react";
import { AVIATION_PRESETS } from "@/lib/aviation-scenario";
import { ShareLinkButton } from "../ShareLinkButton";

interface Props {
  agentPending: boolean;
  presetLabel: string;
  onPreset: (key: keyof typeof AVIATION_PRESETS) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}

const ORDER: (keyof typeof AVIATION_PRESETS)[] = [
  "routine",
  "fadec",
  "mcasShape",
  "eicas",
];

export function AviationScenarioControls({
  agentPending,
  presetLabel,
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
    <div className="surface p-4 sm:p-5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="eyebrow">Demo levers</div>
        <div className="flex items-center gap-3 flex-wrap">
          {agentPending && (
            <span className="mono text-[10px] uppercase tracking-wider text-coral">
              agent reasoning…
            </span>
          )}
          <ShareLinkButton disabled={disabled} />
          <button
            onClick={() => wrap(onReset)}
            disabled={disabled}
            className="btn btn-ghost text-xs"
          >
            <RotateCcw size={11} /> Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {ORDER.map((key) => {
          const p = AVIATION_PRESETS[key];
          const active = p.label === presetLabel;
          return (
            <button
              key={key}
              onClick={() => wrap(() => onPreset(key))}
              disabled={disabled}
              className={`rounded-[10px] border transition px-3 py-3 text-left ${
                active
                  ? "bg-coral/10 border-coral text-fg"
                  : "bg-surface-2 border-border hover:border-coral text-fg"
              } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="mono text-[11px] uppercase tracking-wider text-fg-mute">
                  {p.label}
                </span>
                {active ? null : <FastForward size={10} className="text-fg-mute" />}
              </div>
              <p className="text-[11.5px] leading-snug text-fg-dim">
                {p.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
