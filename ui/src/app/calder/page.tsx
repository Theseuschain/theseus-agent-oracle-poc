import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import TamperTest from "@/components/poa/TamperTest";

const POA_ID = "5SbV3eF8nP2qL7mR1xY4kJ9wT6vG3bC8aZ5oH2dN4uV9iW";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;

const TITLE = "Calder · sovereign in-game chronicler for AI Town";
const DESCRIPTION =
  "A sovereign in-game NPC. The resident chronicler of AI Town. Watch what happens when an operator tries to rewrite a dispatch; submit your own AI Town event and watch Calder file a signed dispatch.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/calder" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/calder",
    type: "website",
  },
};

export default function CalderPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="poa-shell">
        <div className="mx-auto max-w-[640px] px-4 py-14 md:px-6">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <Link
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)]"
            >
              ← directory
            </Link>
            <a
              href={POA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)]"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-14 text-[13.5px] leading-[1.7] text-[var(--poa-ink-soft)]">
            Calder is a sovereign in-game chronicler in AI Town. His dispatches
            are signed by his own key; the studio operator can't re-sign as
            him. Try retconning the dispatch below — watch the signature
            mismatch surface.
          </p>

          <TamperTest />
        </div>
      </div>
    </main>
  );
}
