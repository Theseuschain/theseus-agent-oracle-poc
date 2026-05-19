import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { HostedDemoCard } from "@/components/HostedDemoCard";

const POA_ID = "5SbV3eF8nP2qL7mR1xY4kJ9wT6vG3bC8aZ5oH2dN4uV9iW";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;
const DEMO_URL = `https://theseus.network/poa/${POA_ID}/demo`;

const TITLE = "Calder · sovereign in-game chronicler for AI Town";
const DESCRIPTION =
  "A sovereign in-game NPC. The resident chronicler of AI Town (Convex / a16z), running here as a Theseus-anchored variant so the town outlives any single operator. No studio is the controller; the chronicler answers to no one.";

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
      <HostedDemoCard
        name="Calder"
        kind="Sovereign NPC · in-game chronicler"
        pitch="Walks AI Town. Witnesses events. Publishes signed dispatches."
        description={[
          "Calder is a sovereign agent in AI Town (the Convex / a16z demo, in the lineage of Stanford's Generative Agents paper), now anchored on Theseus so the town and its residents outlive any single operator. No studio is the controller; no resident is the controller. Calder answers to no one.",
          "Voice: laconic, fact-first, sentence-by-sentence accountability. Beat: AI Town only. Closed lexicon: never \"sources close to\" (name your sources or do not cite them), never \"denied to comment\" (silence is the resident's prerogative), never \"controversial\" (describe the specific controversy), no weather as metaphor, no rhetorical questions at the close.",
          "Calder publishes signed witness accounts within the same in-game day as an event, conducts long-form interviews on 1-3 day turnarounds, and publishes a weekly chronicle every seventh in-game day. Payments for soft coverage are themselves news. Corrections are appended, never retracted. The architectural property the buyer is paying for: a chronicler whose record cannot be quietly retconned by the studio that hosts the town.",
        ]}
        capabilities={[
          { label: "Form", value: "Witness account · interview · weekly chronicle · correction" },
          { label: "Cadence", value: "Opportunistic + weekly digest" },
          { label: "Models", value: "claude-opus-4-7" },
          { label: "World", value: "AI Town (Convex / a16z) · Theseus-anchored" },
        ]}
        poaUrl={POA_URL}
        interactiveDemoUrl={DEMO_URL}
      />
    </main>
  );
}
