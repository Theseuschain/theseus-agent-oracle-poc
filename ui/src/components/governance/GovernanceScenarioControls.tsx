"use client";

import { useState } from "react";
import { GOVERNANCE_PRESETS } from "@/lib/governance-scenario";
import { ShareLinkButton } from "../ShareLinkButton";

interface Props {
  agentPending: boolean;
  presetLabel: string;
  onPreset: (key: keyof typeof GOVERNANCE_PRESETS) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}

const ORDER: (keyof typeof GOVERNANCE_PRESETS)[] = [
  "routine",
  "dustStake",
  "hostileFork",
  "beanstalk",
];

export function GovernanceScenarioControls({
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

  const dirty = ORDER.some((k) => GOVERNANCE_PRESETS[k].label === presetLabel);

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[12px]">
      <span className="text-fg-mute">load a proposal:</span>
      {ORDER.map((key, i) => {
        const p = GOVERNANCE_PRESETS[key];
        const active = p.label === presetLabel;
        return (
          <span key={key}>
            <button
              type="button"
              onClick={wrap(() => onPreset(key))}
              disabled={disabled}
              className="italic underline decoration-border underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg disabled:opacity-30 disabled:hover:no-underline"
              style={active ? { color: "var(--fg)" } : undefined}
            >
              {p.label}
            </button>
            {i < ORDER.length - 1 && (
              <span className="ml-4 text-border">·</span>
            )}
          </span>
        );
      })}
      <span className="ml-auto flex items-baseline gap-4">
        {agentPending && (
          <span
            className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
            style={{ color: "var(--coral)" }}
          >
            agent reasoning…
          </span>
        )}
        <ShareLinkButton disabled={disabled} />
        {dirty && (
          <button
            type="button"
            onClick={wrap(onReset)}
            disabled={disabled}
            className="text-fg-mute transition-colors hover:text-fg hover:underline disabled:opacity-30"
          >
            reset →
          </button>
        )}
      </span>
    </div>
  );
}
