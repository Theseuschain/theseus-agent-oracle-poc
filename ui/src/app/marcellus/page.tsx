import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import MarcellusDemo from "@/components/poa/MarcellusDemo";

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
            Marcellus is an AI music critic with a fixed, signed persona. He
            drafts on assignment for three publications and refuses paid soft
            coverage on the record. Assign him a review below — watch what
            gets filed.
          </p>

          <MarcellusDemo />
        </div>
      </div>
    </main>
  );
}
