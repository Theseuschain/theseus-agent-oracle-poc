import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { readFundState } from "@/lib/launch-sniper/reader";
import { TickList } from "./TickList";

const FUND_ADDRESS = "0xa6fbaadea4e7f58d812d989737d708b279e8bd21";
const BASESCAN_URL = `https://sepolia.basescan.org/address/${FUND_ADDRESS}`;

const SNIPER_TITLE =
  "Launch Sniper. A Theseus agent paper-trading fresh token launches on Base";
const SNIPER_DESCRIPTION =
  "Live demo of a sovereign-shape agent that watches Base mainnet for new Uniswap V3 pools, evaluates each candidate token's contract sanity, mint authority, LP lock, deployer history, and pool depth, then commits a PASS or BUY decision to its LaunchSniperFund contract on Base Sepolia. Real market signal, paper money.";

export const metadata: Metadata = {
  title: SNIPER_TITLE,
  description: SNIPER_DESCRIPTION,
  alternates: { canonical: "/launch-sniper" },
  keywords: [
    "launch sniper",
    "memecoin sniper",
    "token launch evaluator",
    "Uniswap V3 PoolCreated",
    "Base mainnet",
    "Base Sepolia",
    "paper trading agent",
    "sovereign agent",
    "Theseus agent",
    "Claude Haiku 4.5",
    "rug pull detection",
    "Proof of Agenthood",
  ],
  openGraph: {
    title: SNIPER_TITLE,
    description: SNIPER_DESCRIPTION,
    url: "/launch-sniper",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SNIPER_TITLE,
    description: SNIPER_DESCRIPTION,
  },
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
      <div className="mx-auto max-w-[760px] px-4 py-14 md:px-6">
        <div className="mb-10 flex items-baseline justify-between gap-4">
          <a
            href="/"
            className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
          >
            ← directory
          </a>
          <a
            href={BASESCAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
          >
            on chain ↗
          </a>
        </div>

        <p className="mb-12 text-[13.5px] leading-[1.7] text-fg-mute">
          Launch Sniper is a Theseus agent paper-trading fresh Uniswap V3
          launches on Base. Every twenty minutes it picks the most credible
          candidate, commits a PASS or BUY to its on-chain fund, and never
          retunes. The agent&apos;s recent decisions appear below, signed and
          on-chain.
        </p>

        {readError && (
          <div className="mb-8 border-b border-border pb-4">
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              RPC error
            </p>
            <p className="mt-2 font-mono text-[12px] text-fg-mute break-words">
              {readError}
            </p>
            <p className="mt-2 text-[13px] text-fg-mute">
              Base Sepolia RPC is having a moment. Refresh in a few seconds.
            </p>
          </div>
        )}

        {fund && <FundOverview fund={fund} />}
        {fund && fund.positions.some((p) => p.open) && (
          <PositionsPanel positions={fund.positions.filter((p) => p.open)} />
        )}
        {fund && fund.ticks.length > 0 && (
          <div className="mt-10">
            <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              recent ticks · newest first
            </p>
            <TickList ticks={fund.ticks} />
          </div>
        )}
        {fund && fund.ticks.length === 0 && (
          <p className="mt-10 text-[13px] leading-[1.7] text-fg-mute">
            No ticks yet. The agent fires on its next cron interval.
          </p>
        )}
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
    <div className="border-t border-border pt-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-5 gap-x-6">
        <BigStat
          label="paper usdc"
          value={`$${paperUsdc.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub={`of $${startingUsdc.toLocaleString()} starting`}
        />
        <BigStat
          label="open positions"
          value={openCount.toString()}
          sub={`of ${fund.tokenCount} tokens ever touched`}
        />
        <BigStat
          label="ticks"
          value={fund.tickCount.toString()}
          sub={
            fund.ticks.length > 0
              ? `last ${ageRelative(fund.ticks[0].timestamp)}`
              : "none yet"
          }
        />
        <BigStat
          label="realized pnl"
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
    <div className="mt-10">
      <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        open positions
      </p>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-fg-mute font-mono text-[10.5px] uppercase tracking-[0.16em]">
              <th className="py-2 pr-4 font-normal">token</th>
              <th className="py-2 pr-4 font-normal">amount</th>
              <th className="py-2 pr-4 font-normal">cost basis</th>
              <th className="py-2 font-normal">basescan</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.token} className="border-t border-border">
                <td className="py-2 pr-4 font-mono break-all">{p.token}</td>
                <td className="py-2 pr-4 font-mono tnum">{p.amount.toString()}</td>
                <td className="py-2 pr-4 font-mono tnum">
                  ${(Number(p.costBasisUsdc) / 1e6).toFixed(2)}
                </td>
                <td className="py-2">
                  <a
                    className="font-mono hover:underline underline-offset-[3px]"
                    style={{ color: "var(--coral)" }}
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
      <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        {label}
      </p>
      <div className="serif text-2xl md:text-[26px] tnum leading-tight">
        {value}
      </div>
      {sub && (
        <div
          className="font-mono text-[10.5px] mt-0.5"
          style={{
            color:
              tone === "warn"
                ? "var(--coral)"
                : tone === "ok"
                  ? "var(--fg)"
                  : "var(--fg-mute)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
