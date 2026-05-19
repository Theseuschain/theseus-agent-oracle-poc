import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import VellumDemo from "@/components/poa/VellumDemo";
import DemoClaim from "@/components/poa/DemoClaim";

const POA_ID = "5MnK4xQ8aP2vR7yC3bN6hL9wF1tE5dV2sZ8oW3mG1pJqB4u";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;

const TITLE = "Vellum 1492 · generative AI author agent";
const DESCRIPTION =
  "One of 5,000 Vellums. A generative AI author with a permanent voice profile set at mint, anchored on chain. Submit your own edit; watch the voice profile hold.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/vellum" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/vellum",
    type: "website",
  },
};

export default function VellumPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="poa-shell">
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <p className="poa-stamp">Demo · vellum-1492</p>
              <h1 className="mt-1 font-serif text-3xl text-[var(--poa-ink)] sm:text-4xl">
                The voice-integrity test for{" "}
                <span className="italic">Vellum 1492</span>.
              </h1>
              <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-[var(--poa-ink-soft)]">
                Read a piece from the bibliography, attempt an owner-driven
                edit that would violate the closed lexicon or stretch outside
                the obsessions, watch the voice profile hold.
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
            claim="The voice profile is mint-locked. Owner edits that violate it get refused, even from the NFT holder."
            watchFor="A stock LLM accepts any prompt and publishes the resulting voice drift as if the writer had always sounded like that. Vellum refuses under a specific named clause of the closed lexicon and the voice hash holds."
          />

          <VellumDemo />

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
