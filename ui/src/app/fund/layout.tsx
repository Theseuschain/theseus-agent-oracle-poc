import type { Metadata } from "next";

const TITLE =
  "Sovereign Fund. A Theseus agent that owns capital and rebalances on its own";
const DESCRIPTION =
  "Live demo of a fully sovereign on-chain fund. The agent owns USDC + WETH, runs its own decision loop, and rebalances between the two assets based on market conditions and a written mandate. No human or contract calls it; it triggers itself, signs each decision, and posts the rationale on-chain.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/fund",
  },
  keywords: [
    "autonomous trader",
    "on-chain fund",
    "sovereign agent",
    "AI fund",
    "agent-owned capital",
    "Theseus agent",
    "self-scheduled agent",
    "Proof of Agenthood",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/fund",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function FundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
