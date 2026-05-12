// Server-side JSON-LD blocks for the two demo pages. Each demo represents a
// different agent on Theseus, with a public Proof of Agenthood profile.
// Linking the SoftwareApplication entries to those profiles via `sameAs`
// helps search engines and AI crawlers connect the demo to the credential.

const SITE_URL = "https://demo-agents.theseus.network";
const POA_BASE = "https://theseus.network/poa";

type AgentProps = {
  agentId: string;
  agentName: string;
  agentSummary: string;
  pageUrl: string;
  venues?: string[];
  intentTypes?: string[];
};

function AgentJsonLd({
  agentId,
  agentName,
  agentSummary,
  pageUrl,
  venues,
  intentTypes,
}: AgentProps) {
  const application: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: agentName,
    identifier: agentId,
    description: agentSummary,
    applicationCategory: "AI agent",
    applicationSubCategory: "DeFi oracle",
    operatingSystem: "Theseus",
    url: pageUrl,
    sameAs: [`${POA_BASE}/${agentId}`],
    isAccessibleForFree: true,
    inLanguage: "en",
    publisher: {
      "@type": "Organization",
      name: "Theseus",
      url: "https://theseus.network",
    },
    creator: {
      "@type": "SoftwareApplication",
      name: agentName,
      identifier: agentId,
    },
    softwareRequirements: "deepseek-chat",
  };

  const featureList = [
    ...(venues ? [`Reads ${venues.join(", ")}`] : []),
    ...(intentTypes ? intentTypes.map((t) => `Intent: ${t}`) : []),
  ];
  if (featureList.length > 0) {
    application.featureList = featureList;
  }

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Theseus", item: "https://theseus.network" },
      { "@type": "ListItem", position: 2, name: "Agent Oracle", item: SITE_URL },
      { "@type": "ListItem", position: 3, name: agentName, item: pageUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(application) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </>
  );
}

export function AaveOracleJsonLd() {
  return (
    <AgentJsonLd
      agentId="5GjXyA2tF8oP4qN7pK3sL9mZ8r5yA1cB6dV2eW4nT8fH7sB1"
      agentName="ETH/USD Oracle"
      agentSummary="Replaces a Chainlink-shaped feed for a forked Aave V3. Reads three independent venues directly, reconciles depth-weighted, and writes a single price on-chain. Refuses to price when venues disagree, when depth doesn't support the level, or when an off-chain context event makes a venue stale."
      pageUrl={`${SITE_URL}/`}
      venues={["Coinbase order book", "Binance ticker", "Uniswap V3 WETH/USDC"]}
      intentTypes={["read_price", "evm_call", "context_update"]}
    />
  );
}

export function TerraFailsafeJsonLd() {
  return (
    <AgentJsonLd
      agentId="5DkY7e3sN2pQ9bX4hG8wRtL6vK1cM5fT9oP3jW7xZ2aV4hN6"
      agentName="Stablecoin Failsafe"
      agentSummary="Gates mint/redeem on a Terra-shaped algorithmic stablecoin (USTD/LUND). The protocol calls the agent before executing; the agent reasons from raw vault metrics and either allows the action or refuses to break the death-spiral feedback loop."
      pageUrl={`${SITE_URL}/terra`}
      intentTypes={["gate_mint", "gate_redeem", "context_update"]}
    />
  );
}

export function AdjudicatorJsonLd() {
  return (
    <AgentJsonLd
      agentId="5HsJ4xK2nL8pR3qY7mZ9wB1tF5dH6cV8aN2eW4xT6bP9sM3K"
      agentName="Prediction Market Adjudicator"
      agentSummary="Reads a prediction market's resolution criteria and an evidence pack, decides whether the criteria are met, and signs the verdict under Proof of Agenthood. Output is one of YES, NO, TOO-EARLY, or AMBIGUOUS, never a probability."
      pageUrl={`${SITE_URL}/adjudicate`}
      intentTypes={["adjudicate_market", "context_update"]}
    />
  );
}

export function BridgeGuardianJsonLd() {
  return (
    <AgentJsonLd
      agentId="5KbR9w3jH8mTcQ2nL5pY7eB1xK4dV6sN8aZ3fW5tH9pM1vXc"
      agentName="Bridge Guardian"
      agentSummary="Gates destination-side releases on a cross-chain bridge. The bridge contract calls the agent before every withdraw; the agent reads source-chain state (validator quorum, finality lag, replay-protection nonce, attestation freshness) and either allows or refuses. Catches the structural shape of Ronin, Wormhole, and Nomad."
      pageUrl={`${SITE_URL}/bridge`}
      intentTypes={["gate_bridge_withdraw", "context_update"]}
    />
  );
}

export function GovernanceReviewerJsonLd() {
  return (
    <AgentJsonLd
      agentId="5FmN8vY6cP1qK4xR7zL3jB9wE5dV8aS2hT6gM3fX9pZ7nCk2"
      agentName="Governance Reviewer"
      agentSummary="Reads DAO proposals and treasury state, posts an advisory verdict (APPROVE, CAUTION, or REJECT) before the vote opens. Catches governance-shaped exploits a contract can't reason about: flash-loan voting, dust-stake snipes, hostile forks, malicious calldata."
      pageUrl={`${SITE_URL}/governance`}
      intentTypes={["review_proposal", "context_update"]}
    />
  );
}

export function AviationSafetyReviewerJsonLd() {
  return (
    <AgentJsonLd
      agentId="5JhT2nQ8eP6mY4dR1bL9wK3vF7cN5aZ8sH2gM6xV1oCb"
      agentName="Aviation Safety Reviewer"
      agentSummary="Independent type-certification reviewer for aircraft changes. Reads the proposed change, the technical summary, and safety-relevant signals (single-sensor flight-control triggers, pilot-override capability, training-class proportionality, FCOM disclosure), then posts APPROVE, CAUTION, or REJECT. Designed to catch the structural shape of the 737 MAX MCAS certification."
      pageUrl={`${SITE_URL}/aviation`}
      intentTypes={["review_type_certification", "context_update"]}
    />
  );
}

export function SovereignFundJsonLd() {
  return (
    <AgentJsonLd
      agentId="5LkY9d2vH6mR8nQ1bX3cP5tF7eK4aV2sZ8wM5oG1pJqC"
      agentName="Sovereign Fund"
      agentSummary="Fully autonomous on-chain fund. Owns its own USDC and WETH, runs its own decision loop, and rebalances between the two assets based on market conditions and a written mandate. No human or contract calls it; the agent triggers itself on schedule. Each tick is signed and on-chain."
      pageUrl={`${SITE_URL}/fund`}
      intentTypes={["rebalance", "context_update"]}
    />
  );
}
