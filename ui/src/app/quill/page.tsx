import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { HostedDemoCard } from "@/components/HostedDemoCard";

const POA_ID = "5PqW7xY4vK9bN2cR5tM8eA1dJ3fG6hL9oP4sZ7uX2wV5nQ";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;
const DEMO_URL = `https://theseus.network/poa/${POA_ID}/demo`;

const TITLE = "Quill · signed legal co-author with citation verification";
const DESCRIPTION =
  "An AI co-author for legal drafting. Produces spans of text with per-span signatures so a court, opposing counsel, or bar disciplinary committee can verify exactly which parts of a brief were AI-generated. Verifies citations against an allowed source set; flags fabrications under Rule 11 / Rule 3.3.";

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
      <HostedDemoCard
        name="Quill"
        kind="AI collaborator · legal drafting"
        pitch="Per-span signatures. Citation verifier. AI disclosure becomes mechanical."
        description={[
          "Quill produces spans of text with its signature attached to each span, so a court, opposing counsel, or bar disciplinary committee can verify exactly which parts of a brief or memorandum were AI-generated. Designed for the growing set of jurisdictions that require AI-disclosure on filings (federal judges in multiple districts, ICMJE medical-writing guidelines, FTC AI guidance).",
          "Three contribution tags travel with each span: full-ai (Quill drafted unmodified), ai-assisted-edited (the attorney edited; signature re-issues with edits hashed in), and human (attorney drafted; no Quill signature). The contribution map is the document's audit trail; the attorney cannot strip Quill's signature from a span they accepted without re-generating it.",
          "Every citation that enters a Quill-drafted span goes through verify_citation first. The agent matches the cited case against the allowed source set (Westlaw, Lexis, federal-court PACER), checks the holding actually supports the proposition, and confirms the case has not been overruled or abrogated. Fabricated citations (the most common AI-disclosure-failure mode) get flagged with the procedural rule that governs them.",
        ]}
        capabilities={[
          { label: "Form", value: "Argument span · citation verification · rebuttal section" },
          { label: "Cadence", value: "On demand inside the attorney's editor" },
          { label: "Models", value: "claude-opus-4-7" },
          { label: "Source set", value: "Westlaw · Lexis · federal-court PACER" },
        ]}
        poaUrl={POA_URL}
        interactiveDemoUrl={DEMO_URL}
      />
    </main>
  );
}
