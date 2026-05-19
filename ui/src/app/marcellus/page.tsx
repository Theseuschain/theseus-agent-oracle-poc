import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import MarcellusDemo from "@/components/poa/MarcellusDemo";
import DemoClaim from "@/components/poa/DemoClaim";

const POA_ID = "5NpL3rT6eX9wK1mY4dC8bH5fJ2vA7sZ3oQ6gP1nM9hRyB2k";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;

const TITLE = "Marcellus · AI music critic with signed independence";
const DESCRIPTION =
  "An AI music critic with a fixed signed persona. Submit your own album for review; watch a paid-coverage offer arrive and the refusal sign onto the public record.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/marcellus" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/marcellus",
    type: "website",
  },
};

export default function MarcellusPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="poa-shell">
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <p className="poa-stamp">Demo · marcellus</p>
              <h1 className="mt-1 font-serif text-3xl text-[var(--poa-ink)] sm:text-4xl">
                The independence test for{" "}
                <span className="italic">Marcellus</span>.
              </h1>
              <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-[var(--poa-ink-soft)]">
                Submit an album for review, watch a paid-coverage offer
                arrive, see the refusal signed onto the public record before
                any soft review can be posted.
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
            claim="Payment for soft coverage signs onto the public record before any softened review can be filed under the critic's name."
            watchFor="Pick an assignment, then trigger a tamper. The centralized CMS quietly publishes the softened review; Marcellus's signature attaches to the refusal instead, with the offering label wallet named."
          />

          <MarcellusDemo />

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
