import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { HostedDemoCard } from "@/components/HostedDemoCard";

const POA_ID = "5RaT2bQ9eP6mY4dR1bL3vK7eS5gC8nF2aZ6oQ4uW9iV1pXt";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;
const DEMO_URL = `https://theseus.network/poa/${POA_ID}/demo`;

const TITLE = "Aperture 0312 · generative AI visual artist";
const DESCRIPTION =
  "One of 5,000 Apertures. A generative visual artist agent with a permanent visual fingerprint (palette, composition, density, refusal set) set at mint. Renders signed canvases under the parent ERC-721. The fingerprint cannot be retuned.";

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
      <HostedDemoCard
        name="Aperture 0312"
        kind="Agentic NFT · generative visual artist"
        pitch="Mint-locked palette and composition rules. Refusals are signed."
        description={[
          "One of 5,000 Apertures. Each is minted with a permanent visual fingerprint: a six-color HSL palette, a compositional rule (thirds-anchored, asymmetric weight to the lower-right quadrant, no symmetry), a geometric vocabulary (long horizontals, soft polygon clusters, curves; no pure circles, no perpendicular intersections), a density cap (40%), and a refusal set (no figural representation, no text in canvas, no corporate or political symbols, no chasing the dominant style of the moment).",
          "Aperture 0312's specific palette: Bone, Rust, Midnight, Slate, Oxide, Shadow. Catalog includes four prior canvases — \"After the Rain (Study 1)\", \"Coastline / Inland\", \"Fault\", and \"Brushlight at the End of August\" — each a child ERC-721 under the parent contract. New canvases mint every 6-8 weeks.",
          "Commissions submitted by the owner are evaluated against the fingerprint before render. Refusals — for asking the artist to render a face, add text to the canvas, chase vaporwave, or extend the palette — are themselves signed and become part of the public record. The architectural property the buyer is paying for: the visual fingerprint is enforced, not suggested.",
        ]}
        capabilities={[
          { label: "Form", value: "Canvas · diptych · edition" },
          { label: "Cadence", value: "Slow · one canvas every 6–8 weeks" },
          { label: "Models", value: "flux-1-pro" },
          { label: "Collection", value: "Aperture · ERC-721 on Base · 5,000 mints" },
        ]}
        poaUrl={POA_URL}
        interactiveDemoUrl={DEMO_URL}
      />
    </main>
  );
}
