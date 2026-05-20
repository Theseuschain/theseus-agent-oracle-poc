"use client";

import { useState } from "react";
import { AVIATION_PRESETS } from "@/lib/aviation-scenario";

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
    if (disabled) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[12px]">
      <span className="text-fg-mute">pick a change:</span>
      {ORDER.map((key, i) => {
        const p = AVIATION_PRESETS[key];
        const active = p.label === presetLabel;
        return (
          <span key={key}>
            <button
              type="button"
              onClick={() => wrap(() => onPreset(key))}
              disabled={disabled}
              className={`italic underline decoration-border underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg disabled:opacity-30 disabled:hover:no-underline ${
                active ? "text-fg decoration-fg" : ""
              }`}
            >
              {p.label.toLowerCase()}
            </button>
            {i < ORDER.length - 1 && (
              <span className="ml-4 text-border">·</span>
            )}
          </span>
        );
      })}
      {agentPending && (
        <span
          className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.16em]"
          style={{ color: "var(--coral)" }}
        >
          agent reasoning…
        </span>
      )}
      {!agentPending && presetLabel && (
        <button
          type="button"
          onClick={() => wrap(onReset)}
          disabled={disabled}
          className="ml-auto text-fg-mute transition-colors hover:text-fg hover:underline disabled:opacity-30"
        >
          reset →
        </button>
      )}
    </div>
  );
}
