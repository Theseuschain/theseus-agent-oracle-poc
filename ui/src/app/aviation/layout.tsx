import type { Metadata } from "next";

const TITLE =
  "Aviation Safety Reviewer. A Theseus agent reviewing aircraft type-certification changes";
const DESCRIPTION =
  "Live demo of an independent type-certification reviewer for aircraft changes. The agent reads the proposed change, the technical summary, and safety-relevant signals (single-sensor triggers, pilot override, training class) and posts an advisory verdict before the certifying authority issues its airworthiness directive. Catches the structural shape of the 737 MAX MCAS certification.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/aviation",
  },
  keywords: [
    "aviation safety",
    "type certification",
    "FAA ODA",
    "737 MAX",
    "MCAS",
    "Theseus agent",
    "independent review",
    "captured regulator",
    "AI agent",
    "Proof of Agenthood",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/aviation",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AviationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
