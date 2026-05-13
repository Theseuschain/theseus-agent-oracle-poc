/**
 * Terra Failsafe on-chain commit.
 *
 * After the LLM streams its ALLOW / REFUSE verdict, this module:
 *   1. publishes the dossier + verdict blob to Vercel Blob
 *   2. calls reportAllow() or reportRefuse() on TerraFailsafe
 *   3. returns { txHash, blobUrl, reasonHash } for the UI to display.
 */

import { type Hex } from "viem";
import { DEPLOYED_CONTRACTS } from "../deployed-contracts";
import { publishReasonBlob } from "./blob";
import { basescanTxUrl, getSepoliaWallet } from "./wallet";

const TERRA_ABI = [
  {
    type: "function",
    name: "reportAllow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "action", type: "uint8" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reportRefuse",
    stateMutability: "nonpayable",
    inputs: [
      { name: "action", type: "uint8" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const ACTION = { MINT: 0, REDEEM: 1 } as const;

export interface TerraCommitInput {
  action: "MINT" | "REDEEM";
  decision: "ALLOW" | "REFUSE";
  /** The full dossier + verdict the LLM produced. Published as JSON;
   *  the resulting URL is the off-chain pointer for the reasonHash. */
  blob: Record<string, unknown>;
}

export interface TerraCommitOutcome {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  blobUrl: string | null;
}

export async function commitTerraVerdict(
  input: TerraCommitInput,
): Promise<TerraCommitOutcome> {
  const { reasonHash, blobUrl } = await publishReasonBlob("terra", input.blob);

  const wallet = getSepoliaWallet();
  const fn = input.decision === "ALLOW" ? "reportAllow" : "reportRefuse";
  const txHash = await wallet.writeContract({
    address: DEPLOYED_CONTRACTS.terraFailsafe.address,
    abi: TERRA_ABI,
    functionName: fn,
    args: [ACTION[input.action], reasonHash],
  });

  return {
    txHash,
    txUrl: basescanTxUrl(txHash),
    reasonHash,
    blobUrl,
  };
}
