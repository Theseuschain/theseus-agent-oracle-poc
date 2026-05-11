"use client";

import { Gavel } from "lucide-react";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: () => Promise<void> | void;
}

export function ReviewButton({ busy, pending, onSubmit }: Props) {
  const disabled = busy || pending;

  return (
    <div className="surface p-4 sm:p-6">
      <div className="eyebrow mb-3">Action</div>

      <div className="grid grid-cols-1 gap-1 mb-4 p-1 rounded-[10px] bg-surface-2 border border-border">
        <div className="mono text-xs py-2 px-3 rounded-[7px] bg-coral text-bg flex items-center justify-center gap-2">
          <Gavel size={12} /> Review this proposal
        </div>
      </div>

      <p className="text-xs text-fg-dim mb-3 leading-relaxed">
        The reviewer reads the proposal, the calldata summary, and the
        treasury and voting context, and posts an APPROVE, CAUTION, or
        REJECT verdict before the vote opens. The verdict is advisory; the
        DAO can still vote however it wants.
      </p>

      <button
        type="button"
        onClick={() => onSubmit()}
        className="btn btn-primary w-full justify-center"
        disabled={disabled}
      >
        {pending ? "agent reasoning…" : busy ? "submitting…" : "Run review"}
      </button>

      <div className="mt-3 text-[10px] mono text-fg-mute leading-relaxed">
        <span className="text-green">APPROVE</span>: routine, no structural flags.{" "}
        <span className="text-amber">CAUTION</span>: at least one signal voters
        should weigh.{" "}
        <span className="text-red">REJECT</span>: shape of a known governance
        attack.
      </div>
    </div>
  );
}
