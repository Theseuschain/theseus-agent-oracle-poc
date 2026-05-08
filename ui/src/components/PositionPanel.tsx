"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { UserPosition } from "@/lib/types";
import { formatUsd, formatNumber } from "@/lib/format";

interface Props {
  position: UserPosition | null;
  feedRefused: boolean;
  loading?: boolean;
  onAction: (action: "deposit" | "borrow" | "repay" | "withdraw", amount: string) => Promise<{ ok: boolean; revertReason?: string }>;
}

type Action = "deposit" | "borrow" | "repay" | "withdraw";

const ACTION_META: Record<Action, { label: string; asset: "WETH" | "USDC"; placeholder: string }> = {
  deposit:  { label: "Deposit",  asset: "WETH", placeholder: "1.0" },
  borrow:   { label: "Borrow",   asset: "USDC", placeholder: "1500" },
  repay:    { label: "Repay",    asset: "USDC", placeholder: "max" },
  withdraw: { label: "Withdraw", asset: "WETH", placeholder: "0.5" },
};

export function PositionPanel({ position, feedRefused, loading, onAction }: Props) {
  const { isConnected } = useAccount();
  const [action, setAction] = useState<Action>("deposit");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; revertReason?: string } | null>(null);

  const meta = ACTION_META[action];
  const disabledByRefusal =
    feedRefused && (action === "borrow" || action === "withdraw");

  return (
    <div className="surface p-4 sm:p-6 lg:row-span-2">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="eyebrow mb-1">Your position</div>
          <div className="serif text-xl">Aave V3</div>
        </div>
        <ConnectButton chainStatus="none" showBalance={false} accountStatus="address" />
      </div>

      {!isConnected ? (
        <div className="text-fg-dim text-sm py-8 text-center">
          Connect a wallet to deposit, borrow, or watch a refused price halt your borrow.
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-6 pb-6 border-b border-border">
            <PositionRow
              label="Collateral"
              value={
                position
                  ? `${formatNumber(position.collateralWeth, 4)} WETH`
                  : "–"
              }
              hint={position ? formatUsd(position.collateralUsd) : ""}
            />
            <PositionRow
              label="Debt"
              value={
                position
                  ? `${formatNumber(position.debtUsdc, 2)} USDC`
                  : "–"
              }
              hint={position ? formatUsd(position.debtUsd) : ""}
            />
            <PositionRow
              label="Health factor"
              value={
                position
                  ? formatNumber(position.healthFactor, 3)
                  : "–"
              }
              hint={position && position.healthFactor < 1.5 ? "near liquidation" : ""}
              hintColor={
                !position
                  ? undefined
                  : position.healthFactor < 1.0
                    ? "red"
                    : position.healthFactor < 1.5
                      ? "amber"
                      : undefined
              }
            />
          </div>

          <div className="grid grid-cols-4 gap-1 mb-3 p-1 rounded-[10px] bg-surface-2 border border-border">
            {(["deposit", "borrow", "repay", "withdraw"] as const).map((a) => (
              <button
                key={a}
                className={`mono text-xs py-2 rounded-[7px] transition ${
                  action === a
                    ? "bg-coral text-bg"
                    : "text-fg-dim hover:text-fg"
                }`}
                onClick={() => {
                  setAction(a);
                  setLastResult(null);
                }}
              >
                {ACTION_META[a].label}
              </button>
            ))}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!amount) return;
              setBusy(true);
              setLastResult(null);
              try {
                const result = await onAction(action, amount);
                setLastResult(result);
                if (result.ok) setAmount("");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="relative mb-3">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={meta.placeholder}
                inputMode="decimal"
                className="w-full px-3 py-3 pr-16 mono text-sm rounded-[10px] bg-surface-2 border border-border focus:outline-none focus:border-coral"
                disabled={busy}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-mute mono text-xs">
                {meta.asset}
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full justify-center"
              disabled={busy || !amount || disabledByRefusal}
            >
              {busy
                ? "submitting..."
                : disabledByRefusal
                  ? "halted: feed refused"
                  : meta.label}
            </button>
          </form>

          {lastResult && (
            <div
              className={`mt-3 p-3 rounded-[8px] mono text-xs ${
                lastResult.ok
                  ? "bg-green/5 border border-green/30 text-green"
                  : "bg-red/5 border border-red/30 text-red"
              }`}
            >
              {lastResult.ok ? "tx confirmed" : `reverted: ${lastResult.revertReason ?? "unknown"}`}
            </div>
          )}

          {feedRefused && !lastResult && (
            <p className="mt-4 text-xs text-fg-dim leading-relaxed">
              The agent refused to price ETH this round. Borrow and withdraw are halted by Aave's price-touching paths.
              Repay and deposit still work; they don't depend on a fresh price.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function PositionRow({
  label,
  value,
  hint,
  hintColor,
}: {
  label: string;
  value: string;
  hint?: string;
  hintColor?: "amber" | "red";
}) {
  const hintClass =
    hintColor === "red" ? "text-red" : hintColor === "amber" ? "text-amber" : "text-fg-mute";
  return (
    <div className="flex items-baseline justify-between">
      <div className="eyebrow">{label}</div>
      <div className="text-right">
        <div className="mono text-sm tnum text-fg">{value}</div>
        {hint && <div className={`mono text-[10px] ${hintClass}`}>{hint}</div>}
      </div>
    </div>
  );
}
