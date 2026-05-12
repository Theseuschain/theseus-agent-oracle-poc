/**
 * Reasoning-blob publication + retrieval.
 *
 * Every tick commits a keccak256(blob) on-chain. The blob itself lives
 * here, in Vercel Blob storage, so anyone reading the contract can fetch
 * the full reasoning that produced a decision and verify it matches the
 * on-chain hash.
 *
 * Storage key is `launch-sniper/<reasonHash>.json` with predictable URLs
 * (no random suffix), so the viewer can build a URL from a hash without
 * a separate lookup.
 */

import { put } from "@vercel/blob";
import type { Hex } from "viem";
import type { ReasonBlob } from "./types";

const BLOB_PATH_PREFIX = "launch-sniper";

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

/** Compose the blob's storage path from a reason hash. */
export function blobPath(reasonHash: Hex): string {
  return `${BLOB_PATH_PREFIX}/${reasonHash.toLowerCase()}.json`;
}

/** Public URL for a blob given a reason hash. Vercel Blob's public URL
 *  scheme is stable when `addRandomSuffix: false` is used at write time.
 *  The store-specific subdomain is set via env so the viewer can
 *  reconstruct URLs without an extra round-trip. */
export function blobPublicUrl(reasonHash: Hex): string | null {
  const base = process.env.BLOB_PUBLIC_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${blobPath(reasonHash)}`;
}

/** Publish a reasoning blob to Vercel Blob. Returns the canonical public
 *  URL, or null if blob storage isn't configured (executor still works
 *  in chain-only mode; the on-chain hash is enough for verification). */
export async function publishBlob(
  reasonHash: Hex,
  blob: ReasonBlob,
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const result = await put(
      blobPath(reasonHash),
      JSON.stringify(blob, bigintReplacer, 2),
      {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json",
        allowOverwrite: false,
      },
    );
    return result.url;
  } catch (err) {
    // Already-published blobs raise BlobAlreadyExists. Compute the URL
    // we would have written to and return it. Anything else: bubble null.
    const msg = (err as Error)?.message ?? "";
    if (/already exists/i.test(msg)) return blobPublicUrl(reasonHash);
    console.error("publishBlob failed", err);
    return null;
  }
}

/** Fetch and parse a stored reasoning blob by hash. Returns null when
 *  the blob isn't found or storage isn't configured. */
export async function fetchBlob(
  reasonHash: Hex,
): Promise<ReasonBlob | null> {
  const url = blobPublicUrl(reasonHash);
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ReasonBlob;
  } catch {
    return null;
  }
}
