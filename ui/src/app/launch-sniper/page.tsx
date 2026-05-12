import Link from "next/link";
import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { readFundState } from "@/lib/launch-sniper/reader";
import { TickList } from "./TickList";

const FUND_ADDRESS = "0xa6fbaadea4e7f58d812d989737d708b279e8bd21";
const POA_URL =
  "https://theseus.network/poa/5GnT4xK7eW2pR9qB6yA3sL5mZ1cV8dN4fH8jM2vXp7Q3hLb1";
const BASESCAN_URL = `https://sepolia.basescan.org/address/${FUND_ADDRESS}`;

export const metadata: Metadata = {
  title: "Launch Sniper",
  description:
    "Watches Base mainnet for fresh Uniswap V3 pools, evaluates each candidate token, and posts a paper-trade decision to its Base Sepolia LaunchSniperFund contract. Live history of every tick the agent has committed.",
  alternates: { canonical: "/launch-sniper" },
};

// Refresh chain state at most every 30s; the cron only fires every 20 min
// so anything tighter is wasted RPC.
export const revalidate = 30;

export default async function LaunchSniperPage() {
  let fund: Awaited<ReturnType<typeof readFundState>> | null = null;
  let readError: string | null = null;
  try {
    fund = await readFundState();
  } catch (err) {
    readError = (err as Error).message;
  }

  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
        <header className="mb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
            <div className="eyebrow">Launch Sniper · paper trading · Base Sepolia</div>
            <span className="badge badge-stale">GitHub Actions cron · every 20 min</span>
          </div>
          <h1 className="serif text-3xl md:text-4xl leading-[1.1] tracking-tight mb-4">
            {tickHeadline(fund)}
          </h1>
          <p className="text-fg-dim text-[14.5px] leading-relaxed max-w-3xl">
            The agent watches Base mainnet for fresh Uniswap V3 pools paired with
            USDC or WETH, runs each candidate through Claude Haiku 4.5 with the
            checklist published on its{" "}
            <a
              href={POA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-coral hover:underline underline-offset-[3px]"
            >
              Proof of Agenthood profile
            </a>
            , and commits a PASS or BUY decision to the on-chain LaunchSniperFund.
            Real market signal, paper money. Click any tick to read the full
            dossier and reasoning blob.
          </p>
        </header>

        {readError && (
          <div className="surface p-5 mb-6">
            <div className="eyebrow text-amber mb-1">RPC error</div>
            <p className="mono text-[12px] text-fg-dim break-words">{readError}</p>
            <p className="text-[13px] mt-3">
              Base Sepolia RPC is having a moment. Refresh in a few seconds.
            </p>
          </div>
        )}

        {fund && <FundOverview fund={fund} />}
        {fund && fund.positions.some((p) => p.open) && (
          <PositionsPanel positions={fund.positions.filter((p) => p.open)} />
        )}
        {fund && fund.ticks.length > 0 && <TickList ticks={fund.ticks} />}
        {fund && fund.ticks.length === 0 && (
          <div className="surface p-6 text-center">
            <p className="text-fg-dim text-[14px]">
              No ticks yet. The agent will fire on its next cron interval, or
              you can hit{" "}
              <code className="mono text-coral">/api/agent/launch-sniper/tick</code>{" "}
              to trigger one immediately.
            </p>
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-border flex flex-wrap items-baseline justify-between gap-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a
              href={BASESCAN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
            >
              Watch on Basescan ↗
            </a>
            <a
              href={POA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
            >
              System prompt on PoA ↗
            </a>
            <Link
              href="/"
              className="mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
            >
              ← Back to demo agents
            </Link>
          </div>
          <span className="mono text-[10.5px] text-fg-mute">
            chain state · refreshed every 30s
          </span>
        </footer>
      </div>
    </main>
  );
}

function FundOverview({
  fund,
}: {
  fund: Awaited<ReturnType<typeof readFundState>>;
}) {
  const paperUsdc = Number(fund.paperUsdc) / 1e6;
  const startingUsdc = Number(fund.startingUsdc) / 1e6;
  const realizedPnlUsdc = sumProceeds(fund.positions) - sumCostBasis(fund.positions, /* closedOnly */ true);
  const realizedPnlPct =
    startingUsdc > 0 ? (realizedPnlUsdc / startingUsdc) * 100 : 0;
  const openCount = fund.positions.filter((p) => p.open).length;
  return (
    <div className="surface p-5 md:p-6 mb-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-5 gap-x-6">
        <BigStat
          label="Paper USDC"
          value={`$${paperUsdc.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub={`of $${startingUsdc.toLocaleString()} starting`}
        />
        <BigStat
          label="Open positions"
          value={openCount.toString()}
          sub={`of ${fund.tokenCount} tokens ever touched`}
        />
        <BigStat
          label="Ticks"
          value={fund.tickCount.toString()}
          sub={
            fund.ticks.length > 0
              ? `last ${ageRelative(fund.ticks[0].timestamp)}`
              : "none yet"
          }
        />
        <BigStat
          label="Realized PnL"
          value={`${realizedPnlUsdc >= 0 ? "+" : ""}$${realizedPnlUsdc.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub={`${realizedPnlPct >= 0 ? "+" : ""}${realizedPnlPct.toFixed(2)}% vs cost basis`}
          tone={realizedPnlUsdc >= 0 ? "ok" : "warn"}
        />
      </div>
    </div>
  );
}

function PositionsPanel({
  positions,
}: {
  positions: Awaited<ReturnType<typeof readFundState>>["positions"];
}) {
  return (
    <div className="surface p-5 md:p-6 mb-5">
      <div className="eyebrow mb-4">Open positions</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-fg-mute mono text-[10.5px] uppercase tracking-wider">
              <th className="pb-2 pr-4">Token</th>
              <th className="pb-2 pr-4">Amount</th>
              <th className="pb-2 pr-4">Cost basis</th>
              <th className="pb-2">Basescan</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.token} className="border-t border-border">
                <td className="py-2 pr-4 mono break-all">{p.token}</td>
                <td className="py-2 pr-4 mono tnum">{p.amount.toString()}</td>
                <td className="py-2 pr-4 mono tnum">
                  ${(Number(p.costBasisUsdc) / 1e6).toFixed(2)}
                </td>
                <td className="py-2">
                  <a
                    className="mono text-coral hover:underline underline-offset-[3px]"
                    href={`https://basescan.org/address/${p.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    open ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sumProceeds(
  positions: Awaited<ReturnType<typeof readFundState>>["positions"],
): number {
  return positions.reduce((sum, p) => sum + Number(p.proceedsUsdc) / 1e6, 0);
}
function sumCostBasis(
  positions: Awaited<ReturnType<typeof readFundState>>["positions"],
  closedOnly: boolean,
): number {
  return positions
    .filter((p) => (closedOnly ? !p.open : true))
    .reduce((sum, p) => sum + Number(p.costBasisUsdc) / 1e6, 0);
}

function tickHeadline(
  fund: Awaited<ReturnType<typeof readFundState>> | null,
): string {
  if (!fund) {
    return "Loading agent state.";
  }
  if (fund.tickCount === 0) {
    return "The agent has not ticked yet. Standing by.";
  }
  const buys = fund.ticks.filter((t) => t.action === "BUY_TOKEN").length;
  const passes = fund.ticks.filter((t) => t.action === "PASS").length;
  const sells = fund.ticks.filter((t) => t.action === "SELL_TOKEN").length;
  const n = fund.tickCount;
  const noun = n === 1 ? "tick" : "ticks";
  if (buys === 0 && sells === 0) {
    return `${n} ${noun} since deploy. Passing on everything so far.`;
  }
  const parts: string[] = [];
  if (buys > 0) parts.push(`${buys} buy${buys === 1 ? "" : "s"}`);
  if (sells > 0) parts.push(`${sells} sell${sells === 1 ? "" : "s"}`);
  if (passes > 0) parts.push(`${passes} pass${passes === 1 ? "" : "es"}`);
  return `${n} ${noun} since deploy. ${parts.join(", ")}.`;
}

function ageRelative(timestamp: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function BigStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="serif text-2xl md:text-[26px] tnum leading-tight">
        {value}
      </div>
      {sub && (
        <div
          className={`mono text-[10.5px] mt-0.5 ${
            tone === "warn" ? "text-amber" : tone === "ok" ? "text-green" : "text-fg-mute"
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
