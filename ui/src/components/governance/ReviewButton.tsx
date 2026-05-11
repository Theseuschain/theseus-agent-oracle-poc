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
      <div className="flex items-center gap-2 mb-3">
        <Gavel size={12} className="text-coral" />
        <div className="eyebrow">Review this proposal</div>
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
