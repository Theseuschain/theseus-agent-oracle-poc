/**
 * Generic reason-blob publication. Same Vercel-Blob mechanism the
 * launch-sniper uses, but namespaced per agent so a hash collision
 * across agents is impossible and the URL identifies which surface
 * the reasoning belongs to.
 *
 * Storage key: `agents/<agentSlug>/<reasonHash>.json`
 * Public URL:  ${BLOB_PUBLIC_BASE_URL}/agents/<agentSlug>/<reasonHash>.json
 */

import { put } from "@vercel/blob";
import { keccak256, toBytes, type Hex } from "viem";

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

function blobPath(agentSlug: string, reasonHash: Hex): string {
  return `agents/${agentSlug}/${reasonHash.toLowerCase()}.json`;
}

/** Build a URL for a blob given the agent slug + hash. Null when blob
 *  storage isn't configured. */
export function blobPublicUrl(
  agentSlug: string,
  reasonHash: Hex,
): string | null {
  const base = process.env.BLOB_PUBLIC_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${blobPath(agentSlug, reasonHash)}`;
}

/** Serialize a reason blob and publish it. Returns the hash (keccak256
 *  of the canonical JSON) and the public URL. The on-chain commit
 *  records the hash; the URL is the off-chain pointer. */
export async function publishReasonBlob<T>(
  agentSlug: string,
  payload: T,
): Promise<{ reasonHash: Hex; blobUrl: string | null }> {
  const json = JSON.stringify(payload, bigintReplacer, 2);
  const reasonHash = keccak256(toBytes(json));

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { reasonHash, blobUrl: null };
  }

  try {
    const result = await put(blobPath(agentSlug, reasonHash), json, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      allowOverwrite: false,
    });
    return { reasonHash, blobUrl: result.url };
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    if (/already exists/i.test(msg)) {
      // Already published — same hash, same content; URL is deterministic.
      return { reasonHash, blobUrl: blobPublicUrl(agentSlug, reasonHash) };
    }
    console.error("publishReasonBlob failed", err);
    return { reasonHash, blobUrl: null };
  }
}
