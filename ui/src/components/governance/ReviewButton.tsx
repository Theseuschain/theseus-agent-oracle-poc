"use client";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: () => Promise<void> | void;
}

export function ReviewButton({ busy, pending, onSubmit }: Props) {
  const disabled = busy || pending;

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[12px]">
      <button
        type="button"
        onClick={() => onSubmit()}
        disabled={disabled}
        className="italic underline decoration-border underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg disabled:opacity-30 disabled:hover:no-underline"
      >
        {pending ? "agent reasoning…" : busy ? "submitting…" : "run review →"}
      </button>
      <span className="text-fg-mute">
        approve · caution · reject. advisory only; the DAO still votes.
      </span>
    </div>
  );
}
