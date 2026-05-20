"use client";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: () => Promise<void> | void;
}

export function AviationReviewButton({ busy, pending, onSubmit }: Props) {
  const disabled = busy || pending;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSubmit()}
        disabled={disabled}
        className="w-full border-b border-border py-3 text-left font-mono text-[12px] uppercase tracking-[0.18em] text-fg transition-colors hover:text-coral disabled:opacity-40 disabled:hover:text-fg"
      >
        {pending ? "agent reasoning…" : busy ? "submitting…" : "run review →"}
      </button>
      <p className="mt-3 text-[11.5px] leading-relaxed text-fg-mute">
        The reviewer reads the change and posts an{" "}
        <span className="font-bold" style={{ color: "var(--green)" }}>APPROVE</span>,{" "}
        <span className="font-bold" style={{ color: "var(--coral)" }}>CAUTION</span>, or{" "}
        <span className="font-bold" style={{ color: "var(--coral)" }}>REJECT</span> verdict before
        the certification authority issues its airworthiness directive. The
        verdict is advisory.
      </p>
    </div>
  );
}
