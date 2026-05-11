import type { Metadata } from "next";

const TITLE =
  "Governance Reviewer. A Theseus agent reviewing DAO proposals";
const DESCRIPTION =
  "Live demo of a DAO governance flow with a Theseus agent posting an advisory verdict before each vote. The agent reads the proposal text, the calldata summary, and the treasury and voting context, and returns APPROVE, CAUTION, or REJECT with reasoning. Catches the Beanstalk-shape attack, dust-stake snipes, and hostile fork upgrades.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/governance",
  },
  keywords: [
    "DAO governance",
    "governance attack",
    "Beanstalk",
    "flash-loan voting",
    "Theseus agent",
    "DAO advisor",
    "proposal review",
    "AI agent",
    "Proof of Agenthood",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/governance",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function GovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
