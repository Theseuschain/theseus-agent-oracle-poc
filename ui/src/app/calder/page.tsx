import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import TamperTest from "@/components/poa/TamperTest";
import DemoClaim from "@/components/poa/DemoClaim";

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
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <p className="poa-stamp">Demo · calder</p>
              <h1 className="mt-1 font-serif text-3xl text-[var(--poa-ink)] sm:text-4xl">
                The tamper test for{" "}
                <span className="italic">Calder</span>.
              </h1>
              <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-[var(--poa-ink-soft)]">
                Side-by-side demonstration: an operator-edited dispatch in a
                centralized runtime vs. the same edit attempt against a
                Theseus-anchored signature.
              </p>
            </div>
            <Link
              href="/"
              className="poa-stamp underline decoration-[color:var(--poa-rule)] underline-offset-[4px] transition-colors hover:text-[var(--poa-ink)] hover:decoration-[color:var(--poa-ink)]"
            >
              ← back to the directory
            </Link>
          </div>

          <DemoClaim
            claim="An operator can rewrite a centralized dispatch silently. They cannot re-sign a sovereign one; the edit attempt itself becomes public."
            watchFor="Click any operator action. The left pane updates silently. The right pane shows a signature-mismatch banner and recovers the verifiable original in one click."
          />

          <TamperTest />

          <div className="mt-12 pt-6 border-t border-[color:var(--poa-rule)] flex flex-wrap items-baseline justify-end gap-4">
            <a
              href={POA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="poa-stamp underline decoration-[color:var(--poa-rule)] underline-offset-[4px] transition-colors hover:text-[var(--poa-ink)] hover:decoration-[color:var(--poa-ink)]"
            >
              See the credential on Proof of Agenthood ↗
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
