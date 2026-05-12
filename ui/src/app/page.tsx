import Link from "next/link";
import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Demo agents",
  description:
    "Eight Theseus agents you can run in a browser. Each reasons from raw inputs, posts a signed decision blob to a real chain, and publishes its verbatim system prompt on Proof of Agenthood.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Theseus demo agents",
    description:
      "Browse eight autonomous agents — oracles, failsafes, reviewers, and sovereign funds — all running in a browser tab.",
    type: "website",
  },
};

interface AgentCard {
  slug: string;
  name: string;
  /** Short genus tag, e.g. "Oracle replacement". */
  kind: string;
  /** One-line pitch shown under the name. */
  pitch: string;
  /** One-paragraph description. */
  description: string;
  /** Local route to the demo. */
  href: string;
  /** PoA profile (the verbatim system prompt + credential). */
  poaUrl: string;
  /** Optional small badge. "Live" / "Paper" / "Coming soon" etc. */
  badge?: string;
  badgeTone?: "live" | "paper" | "soon";
}

const AGENTS: AgentCard[] = [
  {
    slug: "aave",
    name: "ETH/USD Oracle",
    kind: "Oracle replacement",
    pitch: "Reads three venues, refuses when they disagree.",
    description:
      "Replaces a Chainlink-shaped feed for a forked Aave V3. Reads Coinbase, Binance, and Uniswap directly; reconciles depth-weighted; refuses to price when venues disagree, depth doesn't support the level, or an off-chain context event makes a venue stale. Catches the Mango Markets pump-the-venue shape by construction.",
    href: "/aave",
    poaUrl:
      "https://theseus.network/poa/5GjXyA2tF8oP4qN7pK3sL9mZ8r5yA1cB6dV2eW4nT8fH7sB1",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "terra",
    name: "Stablecoin Failsafe",
    kind: "Mechanism gate",
    pitch: "Gates mint/redeem on a Terra-shaped algo stable.",
    description:
      "USTD targets $1, LUND is the volatile token, mint and redeem at oracle price. Before every action the protocol asks the agent. It reads peg, redemption velocity, LUND supply growth, and backing coverage — and reasons whether running the mechanism right now stabilizes or amplifies the death spiral.",
    href: "/terra",
    poaUrl:
      "https://theseus.network/poa/5DkY7e3sN2pQ9bX4hG8wRtL6vK1cM5fT9oP3jW7xZ2aV4hN6",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "adjudicate",
    name: "Prediction Market Adjudicator",
    kind: "Resolution oracle",
    pitch: "Resolves markets with live web search.",
    description:
      "When a prediction market hits its deadline, the contract asks the agent which option won. The agent runs live web_search, fetches sources, and returns winning_option + confidence + evidence summary — or refuses if the event hasn't actually happened yet. Multi-option-aware.",
    href: "/adjudicate",
    poaUrl:
      "https://theseus.network/poa/5HsJ4xK2nL8pR3qY7mZ9wB1tF5dH6cV8aN2eW4xT6bP9sM3K",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "bridge",
    name: "Bridge Guardian",
    kind: "Cross-chain gate",
    pitch: "Last-line check on cross-chain releases.",
    description:
      "Gates destination-side releases on a cross-chain bridge. Reads attestation quorum, source-chain finality lag, validator rotations, slashings, and replay-protection nonces. Catches the structural shape of Ronin, Wormhole, and Nomad before another nine-figure release goes out the door.",
    href: "/bridge",
    poaUrl:
      "https://theseus.network/poa/5KbR9w3jH8mTcQ2nL5pY7eB1xK4dV6sN8aZ3fW5tH9pM1vXc",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "governance",
    name: "Governance Reviewer",
    kind: "Proposal reviewer",
    pitch: "Reads DAO proposals before voting opens.",
    description:
      "For every DAO proposal: compares the marketing summary against the actual calldata, checks proposer stake age, voting window length, and treasury share at risk. Flags flash-loan-shaped votes, dust-stake snipes, and Beanstalk-shape drains. Advisory — voters see the verdict before they cast.",
    href: "/governance",
    poaUrl:
      "https://theseus.network/poa/5FmN8vY6cP1qK4xR7zL3jB9wE5dV8aS2hT6gM3fX9pZ7nCk2",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "aviation",
    name: "Aviation Safety Reviewer",
    kind: "Type-cert reviewer",
    pitch: "Independent second opinion on aircraft changes.",
    description:
      "Reviews proposed aircraft changes before the certifying authority issues the airworthiness directive. Posts APPROVE / CAUTION / REJECT based on single-sensor flight-control triggers, pilot-override capability, training-class proportionality, and FCOM disclosure. Built to catch the 737 MAX MCAS shape that cost 346 lives.",
    href: "/aviation",
    poaUrl:
      "https://theseus.network/poa/5JhT2nQ8eP6mY4dR1bL9wK3vF7cN5aZ8sH2gM6xV1oCb",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "fund",
    name: "Sovereign Fund",
    kind: "Self-scheduled trader",
    pitch: "Autonomous on-chain fund. No human caller.",
    description:
      "Owns its own USDC + WETH and runs a self-scheduled tick on its own clock. Reads market state, computes a target weight from its frozen mandate, and executes the rebalance against its own balances through Uniswap V3. The first sovereign-shape agent here — no contract calls it; it triggers itself.",
    href: "/fund",
    poaUrl:
      "https://theseus.network/poa/5LkY9d2vH6mR8nQ1bX3cP5tF7eK4aV2sZ8wM5oG1pJqC",
    badge: "Live · Base Sepolia",
    badgeTone: "live",
  },
  {
    slug: "launch-sniper",
    name: "Launch Sniper",
    kind: "Self-scheduled scout",
    pitch: "Watches Base for fresh launches. Mostly passes.",
    description:
      "Polls Base mainnet for new Uniswap V3 pools, evaluates each new token's contract sanity + mint authority + LP lock + deployer history + holder concentration, and posts a paper-trade decision to its Base Sepolia LaunchSniperFund contract. Real signal, paper money — designed to graduate to real execution once the filter earns its keep.",
    href: "/launch-sniper",
    poaUrl:
      "https://theseus.network/poa/5GnT4xK7eW2pR9qB6yA3sL5mZ1cV8dN4fH8jM2vXp7Q3hLb1",
    badge: "Paper · Base Sepolia",
    badgeTone: "paper",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <header className="mb-12 md:mb-16 max-w-3xl">
          <div className="eyebrow mb-3">Theseus / demo agents</div>
          <h1 className="serif text-4xl md:text-5xl leading-[1.1] tracking-tight mb-5">
            Eight autonomous agents. Each one runs in a browser tab.
          </h1>
          <p className="text-fg-dim text-[15px] leading-relaxed max-w-2xl">
            Each agent reasons from raw inputs — not pre-baked rules — and posts a
            signed decision blob to a real chain. Some are oracle replacements;
            some are gates on a mechanism; some own their own capital. Every
            agent publishes its verbatim system prompt on Proof of Agenthood, so
            you can see exactly what the model sees on every cycle.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {AGENTS.map((agent) => (
            <AgentCardEl key={agent.slug} agent={agent} />
          ))}
        </div>

        <footer className="mt-16 pt-8 border-t border-border flex flex-wrap items-baseline justify-between gap-4">
          <p className="text-fg-dim text-[13px] leading-relaxed max-w-xl">
            These are demos. Some run on a real testnet (Base Sepolia); some run
            against mocked state for narratability. The on-chain commitment
            surface and the system prompt are real either way.
          </p>
          <a
            href="https://theseus.network/poa/agents"
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
          >
            All credentials on Proof of Agenthood ↗
          </a>
        </footer>
      </div>
    </main>
  );
}

function AgentCardEl({ agent }: { agent: AgentCard }) {
  return (
    <article className="surface p-5 md:p-6 flex flex-col gap-4 h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow mb-1.5">{agent.kind}</div>
          <h2 className="serif text-xl md:text-[22px] leading-tight tracking-tight mb-1.5">
            {agent.name}
          </h2>
          <p className="mono text-[11.5px] text-fg-dim leading-relaxed">
            {agent.pitch}
          </p>
        </div>
        {agent.badge && (
          <span
            className={`badge shrink-0 ${
              agent.badgeTone === "live"
                ? "badge-priced"
                : agent.badgeTone === "paper"
                  ? "badge-stale"
                  : "badge-stale"
            }`}
          >
            {agent.badge}
          </span>
        )}
      </div>

      <p className="text-fg text-[13px] leading-relaxed flex-grow">
        {agent.description}
      </p>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link
          href={agent.href}
          className="mono text-[11px] uppercase tracking-wider text-coral hover:underline underline-offset-[3px]"
        >
          Open demo →
        </Link>
        <a
          href={agent.poaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-[10.5px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
        >
          System prompt ↗
        </a>
      </div>
    </article>
  );
}
