import Link from "next/link";
import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Launch Sniper",
  description:
    "Watches Base mainnet for fresh Uniswap V3 pools, evaluates each candidate token, and posts a paper-trade decision to its Base Sepolia LaunchSniperFund contract.",
  alternates: { canonical: "/launch-sniper" },
};

const FUND_ADDRESS = "0xa6fbaadea4e7f58d812d989737d708b279e8bd21";
const POA_URL =
  "https://theseus.network/poa/5GnT4xK7eW2pR9qB6yA3sL5mZ1cV8dN4fH8jM2vXp7Q3hLb1";
const BASESCAN_URL = `https://sepolia.basescan.org/address/${FUND_ADDRESS}`;

export default function LaunchSniperPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="eyebrow mb-3">Launch Sniper · paper trading</div>
        <h1 className="serif text-4xl md:text-5xl leading-[1.1] tracking-tight mb-5">
          The agent is running. The viewer isn&apos;t built yet.
        </h1>
        <p className="text-fg-dim text-[15px] leading-relaxed mb-8 max-w-2xl">
          A Vercel cron triggers the loop every 20 minutes: indexer scans Base
          mainnet for new Uniswap V3 pools paired with USDC or WETH, the
          research module reads token metadata + pool state, Claude Haiku 4.5
          evaluates against a strict checklist, and the executor posts a
          paper-trade <code className="mono">tick()</code> to the LaunchSniperFund
          on Base Sepolia. No real money moves. The on-chain reasonHash points
          at the full dossier + decision blob.
        </p>

        <div className="surface p-5 md:p-6 mb-6">
          <div className="eyebrow mb-2">On-chain state</div>
          <ul className="space-y-2 text-[13.5px] leading-relaxed">
            <li>
              <span className="mono text-fg-dim mr-2">contract</span>
              <a
                href={BASESCAN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-coral hover:underline underline-offset-[3px] break-all"
              >
                {FUND_ADDRESS}
              </a>
            </li>
            <li>
              <span className="mono text-fg-dim mr-2">network</span>
              <span className="mono">Base Sepolia · chain id 84532</span>
            </li>
            <li>
              <span className="mono text-fg-dim mr-2">starting capital</span>
              <span className="mono">10,000 USDC (virtual)</span>
            </li>
            <li>
              <span className="mono text-fg-dim mr-2">tick cadence</span>
              <span className="mono">Vercel cron · every 20 min</span>
            </li>
          </ul>
        </div>

        <div className="surface p-5 md:p-6 mb-8">
          <div className="eyebrow mb-2">What lands next</div>
          <p className="text-[13px] leading-relaxed text-fg">
            Phase 2: a live viewer with the fund&apos;s open positions,
            mark-to-market PnL, and a scrollable history of evaluations
            (PASS / BUY) with the agent&apos;s reasoning for each. The data is
            already on-chain; the viewer just needs to query <code className="mono">tickCount()</code>
            , walk the <code className="mono">ticks(i)</code> array, and resolve
            each <code className="mono">reasonHash</code> to its blob.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <a
            href={POA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[11px] uppercase tracking-wider text-coral hover:underline underline-offset-[3px]"
          >
            Read the system prompt on PoA ↗
          </a>
          <a
            href={BASESCAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
          >
            Watch on Basescan ↗
          </a>
          <Link
            href="/"
            className="mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
          >
            ← Back to demo agents
          </Link>
        </div>
      </div>
    </main>
  );
}
