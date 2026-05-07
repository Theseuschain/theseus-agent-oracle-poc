import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

const SITE_URL = "https://agent-oracle.theseus.network";
const TITLE = "Theseus Agent Oracle · Aave V3 priced by an autonomous agent";
const DESCRIPTION =
  "Live demo: Aave V3, unmodified, with a Theseus agent in the price-oracle slot. Reads Coinbase, Binance, and Uniswap directly, refuses to price when venues disagree, and would have caught the Mango Markets pump-the-venue exploit. Includes a Terra-shaped algorithmic stablecoin failsafe.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Theseus Agent Oracle",
  },
  description: DESCRIPTION,
  applicationName: "Theseus Agent Oracle",
  keywords: [
    "Theseus",
    "Aave V3",
    "agent oracle",
    "AI oracle",
    "DeFi agent",
    "price oracle",
    "Mango Markets",
    "Terra Luna",
    "algorithmic stablecoin",
    "PolkaVM",
    "pallet-revive",
    "DeepSeek",
    "autonomous agent",
    "Proof of Agenthood",
  ],
  alternates: {
    canonical: "/",
  },
  authors: [{ name: "Theseus", url: "https://theseus.network" }],
  creator: "Theseus",
  publisher: "Theseus",
  category: "technology",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "Theseus Agent Oracle",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    site: "@theseus_network",
    creator: "@theseus_network",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} ${fraunces.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
