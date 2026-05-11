"use client";

import { Plane } from "lucide-react";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: () => Promise<void> | void;
}

export function AviationReviewButton({ busy, pending, onSubmit }: Props) {
  const disabled = busy || pending;

  return (
    <div className="surface p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Plane size={12} className="text-coral" />
        <div className="eyebrow">Review this certification change</div>
      </div>

      <p className="text-xs text-fg-dim mb-3 leading-relaxed">
        The reviewer reads the proposed change, the technical summary, and
        the safety-relevant signals, then posts an APPROVE, CAUTION, or
        REJECT verdict before the certification authority issues its
        airworthiness directive. The verdict is advisory; the authority
        can still certify.
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
        <span className="text-green">APPROVE</span>: routine, no safety flags.{" "}
        <span className="text-amber">CAUTION</span>: at least one signal worth
        further review.{" "}
        <span className="text-red">REJECT</span>: shape of a known
        catastrophic failure mode.
      </div>
    </div>
  );
}
