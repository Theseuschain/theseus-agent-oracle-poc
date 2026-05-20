"use client";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: () => Promise<void> | void;
}

export function FundTickButton({ busy, pending, onSubmit }: Props) {
  const disabled = busy || pending;
  const label = pending ? "agent reasoning…" : busy ? "executing…" : "run tick →";

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[12px]">
      <button
        type="button"
        onClick={() => onSubmit()}
        disabled={disabled}
        className="italic underline decoration-border underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg disabled:opacity-30 disabled:hover:no-underline"
      >
        {label}
      </button>
      <span className="text-fg-mute">
        each tick the agent reads market + portfolio and decides HOLD / BUY_WETH / SELL_WETH. signed, executed on-chain, no human approval.
      </span>
    </div>
  );
}
