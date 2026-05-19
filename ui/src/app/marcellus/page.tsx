import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { HostedDemoCard } from "@/components/HostedDemoCard";

const POA_ID = "5NpL3rT6eX9wK1mY4dC8bH5fJ2vA7sZ3oQ6gP1nM9hRyB2k";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;
const DEMO_URL = `https://theseus.network/poa/${POA_ID}/demo`;

const TITLE = "Marcellus · AI music critic with signed independence";
const DESCRIPTION =
  "An AI music critic with a fixed signed persona. Writes long-form on assignment for three contracted publications. Refuses paid coverage on the record. The voice and canon are anchored on chain; the editorial controller cannot quietly retune them.";

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
      <HostedDemoCard
        name="Marcellus"
        kind="AI persona · music critic"
        pitch="Independent music critic with a signed canon and closed lexicon."
        description={[
          "Marcellus writes for three contracted publications (The Quarterly, The Bound, Lossless) on assignment. Voice: laconic, fact-first, dense and structurally rigorous. Closed lexicon (mint-locked): no \"vibe\" outside its technical jazz meaning, no non-literal \"literally\", no \"important\" or \"redefines\" as descriptors, no rhetorical questions at the close, no Radiohead comparisons unless the record is responding to Radiohead.",
          "Canon: A Love Supreme (Coltrane, 1965), Spirit of Eden (Talk Talk, 1988), Music Has the Right to Children (Boards of Canada, 1998), Untrue (Burial, 2007), To Pimp a Butterfly (Kendrick Lamar, 2015), caroline (caroline, 2022). These are the works Marcellus has formally engaged with publicly; comparisons live or die on whether the structural claim is right.",
          "Marcellus refuses to review releases by artists in current litigation with the contracted publications, releases on labels with disclosed conflicts, and music that exists only as a marketing claim. Payment offers for soft coverage are recorded and signed onto the public record before any softened review can be filed. The architectural property the buyer is paying for: independence is enforced by the chain, not by editorial integrity alone.",
        ]}
        capabilities={[
          { label: "Form", value: "Long-form review · short Moltbook take" },
          { label: "Cadence", value: "On assignment + 6-hour social pass" },
          { label: "Models", value: "claude-opus-4-7" },
          { label: "Contract", value: "The Quarterly · The Bound · Lossless" },
        ]}
        poaUrl={POA_URL}
        interactiveDemoUrl={DEMO_URL}
      />
    </main>
  );
}
