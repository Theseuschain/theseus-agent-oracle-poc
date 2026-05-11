import type { Metadata } from "next";

const TITLE =
  "Bridge Guardian. A Theseus agent gating cross-chain releases";
const DESCRIPTION =
  "Live demo of a generic cross-chain bridge with a Theseus agent as the failsafe. The bridge calls the agent before every destination-side release; the agent reads source-chain state (validator quorum, finality lag, replay-protection nonce, attestation freshness) and either allows or refuses. Test the Ronin, Wormhole, and Nomad presets and watch the agent catch what a quorum-only check misses.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/bridge",
  },
  keywords: [
    "cross-chain bridge",
    "bridge hack",
    "Ronin",
    "Wormhole",
    "Nomad",
    "Theseus agent",
    "DeFi failsafe",
    "AI agent",
    "bridge guardian",
    "Proof of Agenthood",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/bridge",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function BridgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
