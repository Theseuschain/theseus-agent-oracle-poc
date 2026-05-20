"use client";

import { useState } from "react";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: (amountUsd: number) => Promise<void> | void;
}

export function WithdrawForm({ busy, pending, onSubmit }: Props) {
  const [amount, setAmount] = useState("5000000");
  const disabled = busy || pending;

  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        release withdraw
      </p>
      <p className="mt-2 text-[13px] leading-[1.7] text-fg-mute">
        A relayer submitted an attestation for this release. The bridge is
        about to send funds to the destination chain. The guardian agent
        checks the source-chain state first.
      </p>

      <form
        className="mt-4 flex items-baseline gap-2 text-[13px]"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(amount);
          if (!Number.isFinite(n) || n <= 0) return;
          onSubmit(n);
        }}
      >
        <span className="text-fg-mute">$</span>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          disabled={disabled}
          className="w-40 border-b border-border bg-transparent font-mono text-[13px] text-fg focus:border-fg focus:outline-none disabled:opacity-50"
        />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
          usd
        </span>
        <button
          type="submit"
          disabled={disabled || !amount}
          className="ml-3 text-fg transition-colors hover:underline disabled:opacity-30 disabled:hover:no-underline"
          style={
            pending ? { color: "var(--coral)" } : undefined
          }
        >
          {pending ? "agent reasoning…" : busy ? "submitting…" : "release →"}
        </button>
      </form>
    </div>
  );
}
