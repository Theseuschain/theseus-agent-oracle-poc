/**
 * Governance Reviewer on-chain commit.
 *
 * Three-way verdict: APPROVE / CAUTION / REJECT per proposal id.
 */

import { type Hex } from "viem";
import { DEPLOYED_CONTRACTS } from "../deployed-contracts";
import { publishReasonBlob } from "./blob";
import { basescanTxUrl, getSepoliaWallet } from "./wallet";

const GOVERNANCE_ABI = [
  {
    type: "function",
    name: "review",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "decision", type: "uint8" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const DECISION = {
  UNINITIALIZED: 0,
  APPROVE: 1,
  CAUTION: 2,
  REJECT: 3,
} as const;

export interface GovernanceCommitInput {
  proposalId: number;
  decision: "APPROVE" | "CAUTION" | "REJECT";
  blob: Record<string, unknown>;
}

export interface GovernanceCommitOutcome {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  blobUrl: string | null;
}

export async function commitGovernanceVerdict(
  input: GovernanceCommitInput,
): Promise<GovernanceCommitOutcome> {
  const { reasonHash, blobUrl } = await publishReasonBlob(
    "governance",
    input.blob,
  );

  const wallet = getSepoliaWallet();
  const txHash = await wallet.writeContract({
    address: DEPLOYED_CONTRACTS.governanceReviewer.address,
    abi: GOVERNANCE_ABI,
    functionName: "review",
    args: [BigInt(input.proposalId), DECISION[input.decision], reasonHash],
  });

  return {
    txHash,
    txUrl: basescanTxUrl(txHash),
    reasonHash,
    blobUrl,
  };
}
