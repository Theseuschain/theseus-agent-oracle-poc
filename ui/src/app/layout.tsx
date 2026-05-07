import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Theseus Agent Oracle",
  description:
    "Aave V3, unmodified. The price oracle is a Theseus agent. Tamper a venue and watch the contract refuse.",
  metadataBase: new URL("https://theseus.network"),
  openGraph: {
    title: "Theseus Agent Oracle",
    description:
      "Aave V3, unmodified. The price oracle is a Theseus agent. Tamper a venue and watch the contract refuse.",
    type: "website",
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
