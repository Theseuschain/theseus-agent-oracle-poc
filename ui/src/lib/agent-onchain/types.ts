/**
 * Shared shape every gate-agent timeline entry uses to record the
 * on-chain commit that followed an LLM verdict. Populated by the
 * `committed` SSE event from the agent's API route.
 */

export interface OnChainCommit {
  /** Tx hash on Base Sepolia. */
  txHash: string;
  /** Pre-built Basescan link to the tx. */
  txUrl: string;
  /** keccak256 of the canonical reasoning blob. */
  reasonHash: string;
  /** Public URL of the reasoning blob, when Blob storage is configured. */
  blobUrl: string | null;
}
