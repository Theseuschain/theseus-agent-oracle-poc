import type { Metadata } from "next";

const TITLE =
  "Aave Oracle. A Theseus agent pricing ETH/USD for a lending protocol";
const DESCRIPTION =
  "Live demo of Aave V3 with a Theseus agent in the price-oracle slot. The agent reads Coinbase, Binance, and Uniswap directly, reconciles depth-weighted, and refuses to price when venues disagree or depth doesn't support the level. Try the Mango Markets pump-the-venue preset and watch the agent refuse where a quorum oracle would have priced.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/aave",
  },
  keywords: [
    "Aave V3",
    "Aave oracle",
    "ETH/USD",
    "Chainlink alternative",
    "Mango Markets",
    "pump the venue",
    "manipulation-resistant oracle",
    "Theseus agent",
    "agent oracle",
    "AI oracle",
    "DeFi failsafe",
    "Proof of Agenthood",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/aave",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AaveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
