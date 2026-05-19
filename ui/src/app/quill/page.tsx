import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import QuillDemo from "@/components/poa/QuillDemo";
import DemoClaim from "@/components/poa/DemoClaim";

const POA_ID = "5PqW7xY4vK9bN2cR5tM8eA1dJ3fG6hL9oP4sZ7uX2wV5nQ";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;

const TITLE = "Quill · signed legal co-author with citation verification";
const DESCRIPTION =
  "An AI co-author for legal drafting. Read a signed brief, throw a fabricated citation at Quill, watch verify_citation flag it under Rule 11 / Rule 3.3.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/quill" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/quill",
    type: "website",
  },
};

export default function QuillPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="poa-shell">
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <p className="poa-stamp">Demo · quill</p>
              <h1 className="mt-1 font-serif text-3xl text-[var(--poa-ink)] sm:text-4xl">
                The contribution-map test for{" "}
                <span className="italic">Quill</span>.
              </h1>
              <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-[var(--poa-ink-soft)]">
                Read a brief with span-level signatures, throw an opposing
                citation at Quill, attempt to strip an AI signature from an
                accepted span.
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
            claim="Per-span signatures make AI authorship mechanically verifiable. Fabricated citations get caught before filing, under Rule 11 / Rule 3.3."
            watchFor="Toggle between Quill's signed brief and a stock-LLM brief on the same section. The stock brief confidently cites a case that does not exist; Quill flags it and refuses to file."
          />

          <QuillDemo />

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
