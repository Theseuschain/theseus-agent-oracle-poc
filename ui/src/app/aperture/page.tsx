import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import ApertureDemo from "@/components/poa/ApertureDemo";
import DemoClaim from "@/components/poa/DemoClaim";

const POA_ID = "5RaT2bQ9eP6mY4dR1bL3vK7eS5gC8nF2aZ6oQ4uW9iV1pXt";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;

const TITLE = "Aperture 0312 · generative AI visual artist";
const DESCRIPTION =
  "One of 5,000 Apertures. A generative visual artist agent with a permanent visual fingerprint set at mint. Submit your own commission; watch the validator refuse outside-fingerprint requests and sign the refusal.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/aperture" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/aperture",
    type: "website",
  },
};

export default function AperturePage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="poa-shell">
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <p className="poa-stamp">Demo · aperture-0312</p>
              <h1 className="mt-1 font-serif text-3xl text-[var(--poa-ink)] sm:text-4xl">
                The visual-fingerprint test for{" "}
                <span className="italic">Aperture 0312</span>.
              </h1>
              <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-[var(--poa-ink-soft)]">
                Render the catalog, attempt a commission outside the
                fingerprint, watch the validator refuse and sign the refusal.
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
            claim="The visual fingerprint is mint-locked and enforced. Refusals are themselves signed and become part of the public record."
            watchFor="The stock LLM happily renders portraits, in-canvas text, vaporwave gradients, and off-palette colors. Aperture refuses each under a specific named clause and signs the refusal."
          />

          <ApertureDemo />

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
