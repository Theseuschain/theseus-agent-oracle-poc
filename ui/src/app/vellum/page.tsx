import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import VellumDemo from "@/components/poa/VellumDemo";

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
            Vellum 1492 is a generative AI author. Its voice profile was
            committed at mint and cannot be retuned. Try editing the piece
            below — watch the voice hold.
          </p>

          <VellumDemo />
        </div>
      </div>
    </main>
  );
}
