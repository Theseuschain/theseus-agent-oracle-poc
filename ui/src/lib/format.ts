export function formatUsd(value: number, opts: { decimals?: number; compact?: boolean } = {}): string {
  const { decimals = 2, compact = false } = opts;
  if (!Number.isFinite(value)) return "–";
  if (compact && Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "–";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

export function formatAge(seconds: number): string {
  if (seconds < 0 || !Number.isFinite(seconds)) return "–";
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function formatHash(hash: string, head = 6, tail = 4): string {
  if (!hash || hash.length < head + tail + 2) return hash;
  return `${hash.slice(0, head + 2)}…${hash.slice(-tail)}`;
}

export function formatBlock(block: number): string {
  return block.toLocaleString("en-US");
}
