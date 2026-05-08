import type { Metadata } from "next";

const TITLE = "Prediction Market Adjudicator · A Theseus agent that reads, decides, and signs";
const DESCRIPTION =
  "A Theseus agent that adjudicates prediction markets: reads a market's resolution criteria and an evidence pack, decides whether the criteria are met, and signs the verdict under Proof of Agenthood. Live demo with four real-shaped markets.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/adjudicate",
  },
  keywords: [
    "Polymarket",
    "prediction market",
    "subjective resolution",
    "AI oracle",
    "Theseus agent",
    "Proof of Agenthood",
    "market adjudication",
    "UMA optimistic oracle",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/adjudicate",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AdjudicateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
