/**
 * Live deployments on Base Sepolia, chain id 84532.
 *
 * Each demo's commitment-surface contract is deployed and signed by
 * the same agent EOA. The UI surfaces a Basescan link on each demo
 * page so a visitor can read the contract that would actually receive
 * the agent's verdict in production.
 *
 * Single source of truth — keep this file in sync with
 * `contracts/deployments/base-sepolia.md`.
 */

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

export const AGENT_EOA = "0xF40294f810DD786E705f20D67075DDa9a7f87F8f" as const;

export interface DeployedContract {
  address: `0x${string}`;
  label: string;
}

export const DEPLOYED_CONTRACTS = {
  sovereignFund: {
    address: "0x3e1cEd606571A35c43DA11a3b21C051690Bd926a",
    label: "SovereignFund",
  },
  launchSniperFund: {
    address: "0xa6FbaadeA4e7f58D812D989737D708B279E8bd21",
    label: "LaunchSniperFund",
  },
  terraFailsafe: {
    address: "0x0B59da3768CB0F1725A1C2183dD1Ad93058394d2",
    label: "TerraFailsafe",
  },
  bridgeGuardian: {
    address: "0xe442277ba5ce3f5aF5eDAE26206976ADC964C26C",
    label: "BridgeGuardian",
  },
  governanceReviewer: {
    address: "0xc9CCF578093603e419997358fa9646Bd891B018a",
    label: "GovernanceReviewer",
  },
  aviationSafetyReviewer: {
    address: "0x453cE65E5D6eBc6C71f3e420e720d2C2E1D03bce",
    label: "AviationSafetyReviewer",
  },
  predictionMarketAdjudicator: {
    address: "0xd14A0963D48B944463F3fE6e776C11e09101bE40",
    label: "PredictionMarketAdjudicator",
  },
} as const satisfies Record<string, DeployedContract>;

export function basescanAddressUrl(address: string): string {
  return `${BASE_SEPOLIA_EXPLORER}/address/${address}`;
}
