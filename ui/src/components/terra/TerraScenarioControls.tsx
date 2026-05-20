"use client";

import { useState } from "react";
import { PRESETS } from "@/lib/terra-scenario";

interface Props {
  agentPending: boolean;
  presetLabel: string;
  onPreset: (key: keyof typeof PRESETS) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}

const ORDER: (keyof typeof PRESETS)[] = ["healthy", "wobble", "cracking", "bankRun", "spiral"];

export function TerraScenarioControls({
  agentPending,
  presetLabel,
  onPreset,
  onReset,
}: Props) {
  const [busy, setBusy] = useState(false);
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

  return (
    <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[12px]">
      <span className="text-fg-mute">load vault state:</span>
      {ORDER.map((key, i) => {
        const p = PRESETS[key];
        const active = presetLabel === p.label;
        return (
          <span key={key}>
            <button
              type="button"
              onClick={wrap(() => onPreset(key))}
              disabled={disabled}
              className="italic underline decoration-border underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg disabled:opacity-30 disabled:hover:no-underline"
              style={{ color: active ? "var(--fg)" : undefined }}
            >
              {p.label.toLowerCase()}
            </button>
            {i < ORDER.length - 1 && (
              <span className="ml-4 text-border">·</span>
            )}
          </span>
        );
      })}
      <button
        type="button"
        onClick={wrap(onReset)}
        disabled={disabled}
        className="ml-auto text-fg-mute transition-colors hover:text-fg hover:underline disabled:opacity-30"
      >
        reset →
      </button>
      {agentPending && (
        <span
          className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
          style={{ color: "var(--coral)" }}
        >
          agent reasoning…
        </span>
      )}
    </div>
  );
}
