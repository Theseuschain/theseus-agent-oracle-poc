"use client";

import { useState } from "react";
import type { TickRow } from "@/lib/launch-sniper/reader";

interface Props {
  ticks: TickRow[];
}

export function TickList({ ticks }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="border-t border-border">
      {ticks.map((tick) => (
        <TickRowEl
          key={tick.index}
          tick={tick}
          open={open === tick.index}
          onToggle={() =>
            setOpen(open === tick.index ? null : tick.index)
          }
        />
      ))}
    </div>
  );
}

function TickRowEl({
  tick,
  open,
  onToggle,
}: {
  tick: TickRow;
  open: boolean;
  onToggle: () => void;
}) {
  const isPass = tick.action === "PASS";
  const isBuy = tick.action === "BUY_TOKEN";
  const isSell = tick.action === "SELL_TOKEN";
  const isHold = tick.action === "HOLD";
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="w-full py-3 flex items-center justify-between gap-4 text-left transition-colors hover:text-fg"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute tnum w-7 shrink-0">
            #{tick.index}
          </span>
          <span
            className="font-mono text-[10.5px] uppercase tracking-[0.16em] shrink-0"
            style={{
              color: isBuy || isSell ? "var(--coral)" : "var(--fg-mute)",
            }}
          >
            {isBuy ? "buy" : isSell ? "sell" : isPass ? "pass" : "hold"}
          </span>
          {!isHold && (
            <span className="font-mono text-[11.5px] text-fg truncate min-w-0">
              {tick.token}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isBuy && (
            <span className="font-mono text-[11.5px] tnum text-fg">
              −${(Number(tick.amountUsdc) / 1e6).toFixed(2)}
            </span>
          )}
          {isSell && (
            <span
              className="font-mono text-[11.5px] tnum"
              style={{ color: "var(--coral)" }}
            >
              +${(Number(tick.amountUsdc) / 1e6).toFixed(2)}
            </span>
          )}
          <span className="font-mono text-[10.5px] text-fg-mute hidden sm:inline">
            {ageRelative(tick.timestamp)}
          </span>
          <span className="font-mono text-[10.5px] text-fg-mute">
            {open ? "↓" : "→"}
          </span>
        </div>
      </button>

      {open && <TickDetail tick={tick} />}
    </div>
  );
}

interface Blob {
  schema: string;
  dossier?: {
    candidate?: {
      pool?: string;
      quote?: string;
      feeTier?: number;
      createdAtBlock?: string;
      txHash?: string;
    };
    token?: {
      address?: string;
      name?: string;
      symbol?: string;
      decimals?: number;
      totalSupply?: string;
    };
    pool?: {
      initialized?: boolean;
      priceQuotePerToken_1e18?: string;
      quoteSideLiquidity?: string;
    };
    assembledAt?: string;
  };
  decision?: {
    decision?: string;
    sizeUsdc?: number;
    checks?: Record<string, unknown>;
    reason?: string;
    reasoning?: string;
  };
  paperFill?: {
    quote?: string;
    quoteAmountIn?: string;
    tokenAmountOut?: string;
  };
  model?: string;
  evaluatedAt?: string;
}

function TickDetail({ tick }: { tick: TickRow }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-fetch on first render
  if (!blob && !loading && !error && tick.blobUrl) {
    setLoading(true);
    fetch(tick.blobUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Blob) => {
        setBlob(j);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }

  return (
    <div className="pb-4 pt-2 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 text-[11.5px]">
        <KV k="reason hash" v={shortHex(tick.reasonHash)} title={tick.reasonHash} />
        <KV
          k="timestamp"
          v={new Date(Number(tick.timestamp) * 1000).toISOString().replace("T", " ").slice(0, 19) + "Z"}
        />
        <KV k="paper usdc after" v={`$${(Number(tick.paperUsdcAfter) / 1e6).toFixed(2)}`} />
        <KV k="tick index" v={`#${tick.index}`} />
      </div>

      {!tick.blobUrl && (
        <p className="font-mono text-[11px] text-fg-mute">
          Blob storage not configured at write-time. The reason hash is the
          full commitment; the reasoning blob isn&apos;t hosted yet
          (set BLOB_READ_WRITE_TOKEN in production to enable).
        </p>
      )}

      {tick.blobUrl && loading && (
        <p className="font-mono text-[11px] text-fg-mute">Loading reasoning blob…</p>
      )}

      {tick.blobUrl && error && (
        <p
          className="font-mono text-[11px]"
          style={{ color: "var(--coral)" }}
        >
          Blob fetch failed: {error}
        </p>
      )}

      {blob?.decision?.reasoning && (
        <div>
          <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
            agent reasoning
          </p>
          <p className="text-[13px] leading-[1.7] text-fg-mute">
            {blob.decision.reasoning}
          </p>
        </div>
      )}

      {blob?.decision?.checks && (
        <div>
          <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
            checklist
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1.5 gap-x-4 text-[11.5px]">
            {Object.entries(blob.decision.checks).map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2">
                <span className="font-mono text-fg-mute">{k}:</span>
                <span className="font-mono">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {blob?.dossier?.token && blob?.dossier?.candidate && (
        <div>
          <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
            dossier
          </p>
          <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-[11.5px]">
            <KV k="name" v={blob.dossier.token.name ?? ""} />
            <KV k="symbol" v={blob.dossier.token.symbol ?? ""} />
            <KV k="quote" v={blob.dossier.candidate.quote ?? ""} />
            <KV k="fee tier" v={`${blob.dossier.candidate.feeTier ?? "?"}`} />
            <KV
              k="pool initialized"
              v={blob.dossier.pool?.initialized ? "yes" : "no"}
            />
            <KV k="decimals" v={`${blob.dossier.token.decimals ?? "?"}`} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1">
        <a
          href={`https://sepolia.basescan.org/tx/${tick.reasonHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute transition-colors hover:text-fg"
        >
          reason hash on basescan ↗
        </a>
        {tick.blobUrl && (
          <a
            href={tick.blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10.5px] uppercase tracking-[0.16em] hover:underline underline-offset-[3px]"
            style={{ color: "var(--coral)" }}
          >
            full reasoning blob ↗
          </a>
        )}
        {tick.action !== "HOLD" && (
          <a
            href={`https://basescan.org/address/${tick.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute transition-colors hover:text-fg"
          >
            token on base mainnet ↗
          </a>
        )}
      </div>
    </div>
  );
}

function KV({
  k,
  v,
  title,
}: {
  k: string;
  v: string;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-mute">
        {k}
      </span>
      <span
        className="font-mono text-fg truncate"
        title={title || v}
      >
        {v}
      </span>
    </div>
  );
}

function shortHex(s: string): string {
  return s.length > 16 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s;
}

function ageRelative(timestamp: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
