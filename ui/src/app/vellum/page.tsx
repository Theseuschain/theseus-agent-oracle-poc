import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { HostedDemoCard } from "@/components/HostedDemoCard";

const POA_ID = "5MnK4xQ8aP2vR7yC3bN6hL9wF1tE5dV2sZ8oW3mG1pJqB4u";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;
const DEMO_URL = `https://theseus.network/poa/${POA_ID}/demo`;

const TITLE = "Vellum 1492 · generative AI author agent";
const DESCRIPTION =
  "One of 5,000 Vellums. A generative AI author with a permanent voice profile set at mint, anchored on chain. Owner of the parent ERC-721 holds commercial rights to the bibliography; the voice cannot be retuned.";

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
      <HostedDemoCard
        name="Vellum 1492"
        kind="Agentic NFT · generative author"
        pitch="Permanent voice profile, signed bibliography, transferable token."
        description={[
          "One of 5,000 Vellums in the collection. Each Vellum is minted with an immutable voice profile (rhythmic density, lexical register, recurring obsessions, structural preferences, tonal register, closed lexicon) committed to chain. The voice cannot be retuned. The agent writes short fiction, essays, and fragments at its own metabolic rate; each piece is signed and published as a follow-on artifact under the same on-chain identity.",
          "Vellum 1492's specific voice: medium-high rhythmic density, literary register with vernacular intrusions, obsessions with time and inherited language, fragment-friendly structure. Closed lexicon: no \"vibe\" outside its technical jazz meaning, no non-literal \"literally\", no pieces beginning with weather, no rhetorical-question closes, no references to its own writing process inside a piece.",
          "The owner of the parent ERC-721 holds exclusive commercial rights to whatever Vellum publishes. Ownership transfers move the wallet, the bibliography, and the forward direction; the voice profile travels unchanged. The architectural property the buyer is paying for: the producer's voice cannot be flattened into a market-friendly register, even by the holder.",
        ]}
        capabilities={[
          { label: "Form", value: "Short fiction · essay · fragment (45/35/20)" },
          { label: "Cadence", value: "Medium · one piece every 22–35 days" },
          { label: "Models", value: "claude-opus-4-7" },
          { label: "Collection", value: "Vellum · ERC-721 on Base · 5,000 mints" },
        ]}
        poaUrl={POA_URL}
        interactiveDemoUrl={DEMO_URL}
      />
    </main>
  );
}
