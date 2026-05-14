/**
 * Aviation Safety Reviewer on-chain commit.
 *
 * Same shape as the governance reviewer: APPROVE / CAUTION / REJECT
 * verdict per change id.
 */

import { type Hex } from "viem";
import { DEPLOYED_CONTRACTS } from "../deployed-contracts";
import { publishReasonBlob } from "./blob";
import { basescanTxUrl, getSepoliaWallet } from "./wallet";

const AVIATION_ABI = [
  {
    type: "function",
    name: "review",
    stateMutability: "nonpayable",
    inputs: [
      { name: "changeId", type: "uint256" },
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

export interface AviationCommitInput {
  changeId: number;
  decision: "APPROVE" | "CAUTION" | "REJECT";
  blob: Record<string, unknown>;
}

export interface AviationCommitOutcome {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  blobUrl: string | null;
}

export async function commitAviationVerdict(
  input: AviationCommitInput,
): Promise<AviationCommitOutcome> {
  const { reasonHash, blobUrl } = await publishReasonBlob(
    "aviation",
    input.blob,
  );

  const wallet = getSepoliaWallet();
  const txHash = await wallet.writeContract({
    address: DEPLOYED_CONTRACTS.aviationSafetyReviewer.address,
    abi: AVIATION_ABI,
    functionName: "review",
    args: [BigInt(input.changeId), DECISION[input.decision], reasonHash],
  });

  return {
    txHash,
    txUrl: basescanTxUrl(txHash),
    reasonHash,
    blobUrl,
  };
}
