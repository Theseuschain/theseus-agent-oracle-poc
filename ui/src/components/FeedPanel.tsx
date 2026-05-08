"use client";

import { FeedSnapshot } from "@/lib/types";
import { formatUsd, formatAge, formatHash, formatBlock } from "@/lib/format";
import { CircleCheck, CircleX, CircleHelp } from "lucide-react";

interface Props {
  feed: FeedSnapshot | null;
  loading?: boolean;
}

export function FeedPanel({ feed, loading }: Props) {
  return (
    <div className="surface p-8 md:p-10 lg:col-span-2">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="eyebrow mb-1.5">Live agent feed</div>
          <div className="serif text-2xl">ETH / USD</div>
        </div>
        <DecisionBadge decision={feed?.decision} />
      </div>

      <div className="serif text-6xl md:text-7xl tnum tracking-tight">
        {loading || !feed ? (
          <span className="text-fg-mute">...</span>
        ) : feed.decision === "REFUSED" ? (
          <span className="text-red">refused</span>
        ) : (
          formatUsd(feed.priceUsd)
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-sm">
        <Stat label="Last update">
          {feed ? formatAge(feed.ageSeconds) : "–"}
        </Stat>
        <Stat label="Block">{feed ? formatBlock(feed.block) : "–"}</Stat>
        <Stat label="Reason hash" mono>
          {feed?.reasonHash && feed.reasonHash !== "0x0000000000000000000000000000000000000000000000000000000000000000"
            ? formatHash(feed.reasonHash, 4, 4)
            : "–"}
        </Stat>
      </div>
    </div>
  );
}

function DecisionBadge({ decision }: { decision?: FeedSnapshot["decision"] }) {
  if (!decision || decision === "UNINITIALIZED") {
    return (
      <span className="badge badge-stale">
        <CircleHelp size={12} /> uninitialized
      </span>
    );
  }
  if (decision === "REFUSED") {
    return (
      <span className="badge badge-refused pulse-coral">
        <CircleX size={12} /> refused
      </span>
    );
  }
  return (
    <span className="badge badge-priced">
      <CircleCheck size={12} /> priced
    </span>
  );
}

function Stat({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className={`text-fg ${mono ? "mono text-xs" : "tnum"}`}>{children}</div>
    </div>
  );
}
