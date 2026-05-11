/**
 * Chain-context preamble for agent user-messages.
 *
 * On Theseus, when a smart contract calls a SHIP agent, the runtime
 * receives the calldata along with the standard chain context:
 *   - msg.sender (which contract is asking)
 *   - block.number
 *   - block.timestamp
 *   - chain id
 *
 * The runtime decodes the calldata into agent inputs and serializes the
 * whole bundle (chain context + business-logic input) into the LLM
 * prompt. The agent signs over both, so the verdict is tied to a
 * specific on-chain moment and the caller can be verified.
 *
 * This helper produces the same chain-context preamble all five demo
 * agents prepend to their user messages, so the demo's prompts match
 * production format. Caller addresses below are mock placeholders
 * stable across calls (deployed contract addresses would replace them
 * in production).
 */

export const THESEUS_CHAIN_ID = 420420420;

export type CallerKey =
  | "aave"
  | "terra"
  | "bridge"
  | "governance"
  | "adjudicator"
  | "aviation"
  | "fund";

const CALLERS: Record<CallerKey, { addr: string; label: string }> = {
  aave: {
    addr: "0xa4e9c2b1f3d8e5a7c0b9d2f4e6a8c1b3d5f7e9c0",
    label: "AaveOracleAggregator",
  },
  terra: {
    addr: "0xb3f6a1c4d7e0d3f2a5c8b1d4e7f0a3c6b9d2e5f8",
    label: "TerraMintRedeemDispatcher",
  },
  bridge: {
    addr: "0xc2d8c4b6a2f5e8d3c9a7b1f0c8d5c4e1f3a6b9d2",
    label: "BridgeDestinationReleaser",
  },
  governance: {
    addr: "0xd9c5a3f2c2e1b0d8c4b6a2f5e8d3c9a7b1f0c8d5",
    label: "DaoGovernorTimelock",
  },
  adjudicator: {
    addr: "0xe7e4c1b5a8d2c6b9a3f0c7e2d9b4f1a6c3d8e5b2",
    label: "PredictionMarketResolver",
  },
  aviation: {
    addr: "0xf1c8e6d4b2a9c7e5d3b1f8a6c4e2d0b9f7a5c3e1",
    label: "AircraftCertificationAuthority",
  },
  // Sovereign agents trigger themselves on their own schedule rather than
  // being called by an external contract. The caller is the agent's own
  // EVM-mapped address and the label flags the call as self-scheduled so
  // an inspector can tell the difference between an external invocation
  // and an autonomous tick.
  fund: {
    addr: "0x09a7c5b3e1d9f7a5c3e1b9d7f5a3c1e9b7d5f3a1",
    label: "SovereignFund (self-scheduled tick)",
  },
};

/** Approximates a Theseus block number from wall-clock time at 12s/block.
 *  Stable enough for a demo: increments as time passes, always 7-8 digits. */
function demoBlockNumber(): number {
  const epochAnchor = 1_700_000_000_000; // ms; arbitrary "demo genesis"
  return 7_000_000 + Math.floor((Date.now() - epochAnchor) / 12_000);
}

export function chainContextLines(callerKey: CallerKey): string[] {
  const c = CALLERS[callerKey];
  return [
    "Chain context:",
    `  caller: ${c.addr} (${c.label})`,
    `  block: ${demoBlockNumber().toLocaleString()}`,
    `  timestamp: ${new Date().toISOString()}`,
    `  chain: theseus (chainId ${THESEUS_CHAIN_ID})`,
    "",
  ];
}
