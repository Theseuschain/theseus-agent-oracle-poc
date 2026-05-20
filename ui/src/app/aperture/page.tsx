import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import ApertureDemo from "@/components/poa/ApertureDemo";

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
            Aperture 0312 is a generative AI visual artist. Its fingerprint —
            palette, composition rules, density cap — was committed at mint.
            Try commissioning a new piece below — watch the fingerprint
            refuse anything outside the spec.
          </p>

          <ApertureDemo />
        </div>
      </div>
    </main>
  );
}
