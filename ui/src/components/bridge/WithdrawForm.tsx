"use client";

import { useState } from "react";
import { ArrowUpFromLine } from "lucide-react";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: (amountUsd: number) => Promise<void> | void;
}

export function WithdrawForm({ busy, pending, onSubmit }: Props) {
  const [amount, setAmount] = useState("5000000");
  const disabled = busy || pending;

  return (
    <div className="surface p-4 sm:p-6">
      <div className="eyebrow mb-3">Action</div>

      <div className="grid grid-cols-1 gap-1 mb-4 p-1 rounded-[10px] bg-surface-2 border border-border">
        <div className="mono text-xs py-2 px-3 rounded-[7px] bg-coral text-bg flex items-center justify-center gap-2">
          <ArrowUpFromLine size={12} /> Release withdraw
        </div>
      </div>

      <p className="text-xs text-fg-dim mb-3 leading-relaxed">
        A relayer submitted an attestation for this release. The bridge
        contract is about to send funds to the user on the destination
        chain. The guardian agent checks the source-chain state first.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(amount);
          if (!Number.isFinite(n) || n <= 0) return;
          onSubmit(n);
        }}
      >
        <div className="relative mb-3">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="w-full px-3 py-3 pr-16 mono text-sm rounded-[10px] bg-surface-2 border border-border focus:outline-none focus:border-coral"
            disabled={disabled}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-mute mono text-xs">
            USD
          </span>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full justify-center"
          disabled={disabled || !amount}
        >
          {pending ? "agent reasoning…" : busy ? "submitting…" : "Release"}
        </button>
      </form>

      <div className="mt-3 text-[10px] mono text-fg-mute leading-relaxed">
        The bridge calls the guardian before every release.
        Agent says <span className="text-green">ALLOW</span>: release fires.{" "}
        <span className="text-red">REFUSE</span>: release reverts.
      </div>
    </div>
  );
}
