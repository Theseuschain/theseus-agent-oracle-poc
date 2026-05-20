"use client";

import { FeedSnapshot } from "@/lib/types";
import { formatUsd, formatAge, formatHash, formatBlock } from "@/lib/format";

interface Props {
  feed: FeedSnapshot | null;
  loading?: boolean;
}

export function FeedPanel({ feed, loading }: Props) {
  const refused = feed?.decision === "REFUSED";
  const priced = feed?.decision === "PRICED";
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        ETH / USD · agent feed
      </p>
      <div className="mt-2 flex items-baseline gap-5">
        <span
          className="serif text-5xl md:text-6xl tnum tracking-tight"
          style={{ color: refused ? "var(--coral)" : "var(--fg)" }}
        >
          {loading || !feed ? "…" : refused ? "refused" : formatUsd(feed.priceUsd)}
        </span>
        {feed && (priced || refused) && (
          <span
            className="text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: refused ? "var(--coral)" : "var(--green)" }}
          >
            {refused ? "refused" : "priced"}
          </span>
        )}
      </div>
      {feed && (
        <p className="mt-3 font-mono text-[10.5px] text-fg-mute">
          {formatAge(feed.ageSeconds)} · block {formatBlock(feed.block)}
          {feed.reasonHash &&
          feed.reasonHash !==
            "0x0000000000000000000000000000000000000000000000000000000000000000"
            ? ` · reason ${formatHash(feed.reasonHash, 4, 4)}`
            : ""}
        </p>
      )}
    </div>
  );
}
