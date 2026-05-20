"use client";

import { useState } from "react";
import { FUND_PRESETS } from "@/lib/fund-scenario";
import { ShareLinkButton } from "../ShareLinkButton";

interface Props {
  agentPending: boolean;
  presetLabel: string;
  onPreset: (key: keyof typeof FUND_PRESETS) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}

const ORDER: (keyof typeof FUND_PRESETS)[] = [
  "calm",
  "bullTrend",
  "drawdown",
  "blackSwan",
];

export function FundScenarioControls({
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
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[12px]">
      <span className="text-fg-mute">load a market:</span>
      {ORDER.map((key, i) => {
        const p = FUND_PRESETS[key];
        const active = p.label === presetLabel;
        return (
          <span key={key}>
            <button
              type="button"
              onClick={wrap(() => onPreset(key))}
              disabled={disabled}
              className={`italic underline underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg disabled:opacity-30 disabled:hover:no-underline ${
                active
                  ? "text-fg decoration-fg"
                  : "decoration-border"
              }`}
              title={p.description}
            >
              {p.label.toLowerCase()}
            </button>
            {i < ORDER.length - 1 && (
              <span className="ml-4 text-border">·</span>
            )}
          </span>
        );
      })}
      <span className="ml-auto flex items-baseline gap-3">
        <ShareLinkButton disabled={disabled} />
        <button
          type="button"
          onClick={wrap(onReset)}
          disabled={disabled}
          className="text-fg-mute transition-colors hover:text-fg hover:underline disabled:opacity-30"
        >
          reset →
        </button>
      </span>
      {agentPending && (
        <span
          className="basis-full font-mono text-[10.5px] uppercase tracking-[0.16em]"
          style={{ color: "var(--coral)" }}
        >
          agent reasoning…
        </span>
      )}
    </div>
  );
}
