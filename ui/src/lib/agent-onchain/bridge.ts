/**
 * Bridge Guardian on-chain commit.
 *
 * Posts reportAllow / reportRefuse against an attestation root.
 */

import { keccak256, toBytes, type Hex } from "viem";
import { DEPLOYED_CONTRACTS } from "../deployed-contracts";
import { publishReasonBlob } from "./blob";
import { basescanTxUrl, getSepoliaWallet } from "./wallet";

const BRIDGE_ABI = [
  {
    type: "function",
    name: "reportAllow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "attestationRoot", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reportRefuse",
    stateMutability: "nonpayable",
    inputs: [
      { name: "attestationRoot", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export interface BridgeCommitInput {
  /** Stable identifier for this scenario / attestation. Hashed to a
   *  bytes32 root so the same scenario always maps to the same key. */
  scenarioKey: string;
  decision: "ALLOW" | "REFUSE";
  blob: Record<string, unknown>;
}

export interface BridgeCommitOutcome {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  attestationRoot: Hex;
  blobUrl: string | null;
}

export async function commitBridgeVerdict(
  input: BridgeCommitInput,
): Promise<BridgeCommitOutcome> {
  const attestationRoot = keccak256(toBytes(input.scenarioKey));
  const { reasonHash, blobUrl } = await publishReasonBlob("bridge", input.blob);

  const wallet = getSepoliaWallet();
  const fn = input.decision === "ALLOW" ? "reportAllow" : "reportRefuse";
  const txHash = await wallet.writeContract({
    address: DEPLOYED_CONTRACTS.bridgeGuardian.address,
    abi: BRIDGE_ABI,
    functionName: fn,
    args: [attestationRoot, reasonHash],
  });

  return {
    txHash,
    txUrl: basescanTxUrl(txHash),
    reasonHash,
    attestationRoot,
    blobUrl,
  };
}
