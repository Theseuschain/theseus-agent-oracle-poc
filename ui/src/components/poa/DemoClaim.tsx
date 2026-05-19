// One-screen TL;DR strip that sits between the page header and each demo
// component. Says what the demo proves and what to watch for, so a busy
// reviewer can pick up the argument in five seconds without reading the
// surrounding prose.

type Props = {
  claim: string;
  watchFor: string;
};

export default function DemoClaim({ claim, watchFor }: Props) {
  return (
    <div
      className="mb-8 grid gap-x-6 gap-y-3 border px-4 py-3 sm:grid-cols-[120px_1fr]"
      style={{ borderColor: "var(--poa-rule)" }}
    >
      <p className="poa-stamp self-baseline">The claim</p>
      <p className="text-[13px] leading-relaxed text-[var(--poa-ink)]">
        {claim}
      </p>
      <p className="poa-stamp self-baseline">Watch for</p>
      <p className="text-[13px] leading-relaxed text-[var(--poa-ink)]">
        {watchFor}
      </p>
    </div>
  );
}
