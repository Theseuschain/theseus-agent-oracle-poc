import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import QuillDemo from "@/components/poa/QuillDemo";

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
            Quill is an AI co-author for legal drafting. Every span carries its
            own signature, so the contribution map is mechanically verifiable.
            Drop a citation below — Quill verifies it against the allowed
            source set and flags fabrications under Rule 11.
          </p>

          <QuillDemo />
        </div>
      </div>
    </main>
  );
}
