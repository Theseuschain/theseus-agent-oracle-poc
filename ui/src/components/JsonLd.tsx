// Server-side JSON-LD blocks for the two demo pages. Each demo represents a
// different agent on Theseus, with a public Proof of Agenthood profile.
// Linking the SoftwareApplication entries to those profiles via `sameAs`
// helps search engines and AI crawlers connect the demo to the credential.

const SITE_URL = "https://agent-oracle.theseus.network";
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
