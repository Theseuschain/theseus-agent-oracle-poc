"use client";

import { Activity } from "lucide-react";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: () => Promise<void> | void;
}

export function FundTickButton({ busy, pending, onSubmit }: Props) {
  const disabled = busy || pending;

  return (
    <div className="surface p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={12} className="text-coral" />
        <div className="eyebrow">Run next tick</div>
      </div>

      <p className="text-xs text-fg-dim mb-3 leading-relaxed">
        Sovereign agents run on their own schedule. Each tick the agent
        reads the current market snapshot and its current portfolio, then
        decides HOLD / BUY_WETH / SELL_WETH. The decision is signed,
        executed on-chain, and posted to the timeline. No human approves
        it; no contract called it.
      </p>

      <button
        type="button"
        onClick={() => onSubmit()}
        className="btn btn-primary w-full justify-center"
        disabled={disabled}
      >
        {pending ? "agent reasoning…" : busy ? "executing…" : "Run tick"}
      </button>

      <div className="mt-3 text-[10px] mono text-fg-mute leading-relaxed">
        <span className="text-fg">HOLD</span>: allocation within mandate.{" "}
        <span className="text-green">BUY_WETH</span>: tilt toward risk.{" "}
        <span className="text-amber">SELL_WETH</span>: tilt defensive.
      </div>
    </div>
  );
}
