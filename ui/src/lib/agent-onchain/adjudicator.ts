/**
 * Prediction Market Adjudicator on-chain commit.
 *
 * Two paths:
 *   - resolve(): RESOLVED with winningOption + confidence
 *   - refuse():  REFUSED, agent declines to resolve (event hasn't happened, etc.)
 */

import { type Hex } from "viem";
import { DEPLOYED_CONTRACTS } from "../deployed-contracts";
import { publishReasonBlob } from "./blob";
import { basescanTxUrl, getSepoliaWallet } from "./wallet";

const ADJUDICATOR_ABI = [
  {
    type: "function",
    name: "resolve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "numOptions", type: "uint8" },
      { name: "winningOption", type: "uint8" },
      { name: "confidencePct", type: "uint8" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refuse",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export type AdjudicatorCommitInput =
  | {
      kind: "resolve";
      marketId: number;
      numOptions: number;
      winningOption: number;
      confidencePct: number;
      blob: Record<string, unknown>;
    }
  | {
      kind: "refuse";
      marketId: number;
      blob: Record<string, unknown>;
    };

export interface AdjudicatorCommitOutcome {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  blobUrl: string | null;
}

export async function commitAdjudicatorVerdict(
  input: AdjudicatorCommitInput,
): Promise<AdjudicatorCommitOutcome> {
  const { reasonHash, blobUrl } = await publishReasonBlob(
    "adjudicator",
    input.blob,
  );

  const wallet = getSepoliaWallet();
  const txHash =
    input.kind === "resolve"
      ? await wallet.writeContract({
          address: DEPLOYED_CONTRACTS.predictionMarketAdjudicator.address,
          abi: ADJUDICATOR_ABI,
          functionName: "resolve",
          args: [
            BigInt(input.marketId),
            input.numOptions,
            input.winningOption,
            input.confidencePct,
            reasonHash,
          ],
        })
      : await wallet.writeContract({
          address: DEPLOYED_CONTRACTS.predictionMarketAdjudicator.address,
          abi: ADJUDICATOR_ABI,
          functionName: "refuse",
          args: [BigInt(input.marketId), reasonHash],
        });

  return {
    txHash,
    txUrl: basescanTxUrl(txHash),
    reasonHash,
    blobUrl,
  };
}
