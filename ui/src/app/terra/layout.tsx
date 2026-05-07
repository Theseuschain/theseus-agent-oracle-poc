import type { Metadata } from "next";

const TITLE = "Terra Failsafe · A Theseus agent gating an algorithmic stablecoin";
const DESCRIPTION =
  "Live demo of a Terra-shaped algorithmic stablecoin (USTD/LUND) with a Theseus agent as the failsafe. The protocol calls the agent before every mint and redeem; the agent reasons from raw vault metrics and either allows or refuses. Test the death-spiral preset and watch the agent catch what a rule-based check misses.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/terra",
  },
  keywords: [
    "Terra Luna",
    "algorithmic stablecoin",
    "UST",
    "LUNA",
    "death spiral",
    "Theseus agent",
    "DeFi failsafe",
    "AI agent",
    "stablecoin gate",
    "Proof of Agenthood",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/terra",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function TerraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
