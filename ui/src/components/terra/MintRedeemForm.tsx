"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { ActionKind } from "@/lib/terra-scenario";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: (action: ActionKind, ustdAmount: number) => Promise<void> | void;
}

export function MintRedeemForm({ busy, pending, onSubmit }: Props) {
  const [tab, setTab] = useState<ActionKind>("MINT");
  const [amount, setAmount] = useState("100000000");

  const disabled = busy || pending;

  return (
    <div className="surface p-6">
      <div className="eyebrow mb-3">Action</div>

      <div className="grid grid-cols-2 gap-1 mb-4 p-1 rounded-[10px] bg-surface-2 border border-border">
        <button
          className={`mono text-xs py-2 rounded-[7px] transition flex items-center justify-center gap-2 ${
            tab === "MINT" ? "bg-coral text-bg" : "text-fg-dim hover:text-fg"
          }`}
          onClick={() => setTab("MINT")}
        >
          <ArrowDownToLine size={12} /> Mint USTD
        </button>
        <button
          className={`mono text-xs py-2 rounded-[7px] transition flex items-center justify-center gap-2 ${
            tab === "REDEEM" ? "bg-coral text-bg" : "text-fg-dim hover:text-fg"
          }`}
          onClick={() => setTab("REDEEM")}
        >
          <ArrowUpFromLine size={12} /> Redeem USTD
        </button>
      </div>

      <p className="text-xs text-fg-dim mb-3 leading-relaxed">
        {tab === "MINT"
          ? "Burn LUND to receive USTD. Adds new USTD claims to the system."
          : "Burn USTD to receive LUND. Forces the protocol to mint new LUND."}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(amount);
          if (!Number.isFinite(n) || n <= 0) return;
          onSubmit(tab, n);
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
            USTD
          </span>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full justify-center"
          disabled={disabled || !amount}
        >
          {pending ? "agent reasoning…" : busy ? "submitting…" : tab === "MINT" ? "Mint" : "Redeem"}
        </button>
      </form>

      <div className="mt-3 text-[10px] mono text-fg-mute leading-relaxed">
        The protocol calls the failsafe agent before executing.
        Agent says <span className="text-green">ALLOW</span>: action goes through.{" "}
        <span className="text-red">REFUSE</span>: action reverts.
      </div>
    </div>
  );
}
