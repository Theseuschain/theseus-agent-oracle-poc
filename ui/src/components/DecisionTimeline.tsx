"use client";

import { useState } from "react";
import { TimelineEntry } from "@/lib/types";
import { formatBlock, formatHash, formatUsd } from "@/lib/format";
import { CircleCheck, CircleX, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  entries: TimelineEntry[];
  loading?: boolean;
}

export function DecisionTimeline({ entries, loading }: Props) {
  return (
    <div className="surface p-6 lg:col-span-3">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1">Recent decisions</div>
          <div className="serif text-lg">Agent timeline</div>
        </div>
        <span className="text-fg-mute mono text-[10px]">
          last {entries.length} runs
        </span>
      </div>

      {loading && entries.length === 0 ? (
        <SkeletonList />
      ) : entries.length === 0 ? (
        <div className="text-fg-dim text-sm py-6 text-center">
          No decisions yet. The agent runs every 10 blocks (~60s).
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {entries.map((e, i) => (
            <TimelineRow key={`${e.block}-${i}`} entry={e} defaultOpen={i === 0 && e.decision === "REFUSED"} />
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineRow({ entry: e, defaultOpen }: { entry: TimelineEntry; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasReasoning = !!e.reasoning;

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          {e.decision === "REFUSED" ? (
            <CircleX size={14} className="text-red" />
          ) : (
            <CircleCheck size={14} className="text-green" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="mono text-[11px] text-fg-mute">
              block {formatBlock(e.block)}
            </span>
            <span
              className={`mono text-[11px] uppercase tracking-wider ${
                e.decision === "REFUSED" ? "text-red" : "text-green"
              }`}
            >
              {e.decision === "REFUSED" ? "refused" : "priced"}
            </span>
          </div>
          <div className="mono text-sm text-fg mt-0.5 tnum truncate">
            {e.decision === "REFUSED" ? (
              <span className="text-fg-dim">
                {e.reason ?? "venue divergence"}
              </span>
            ) : (
              <>
                {e.priceUsd !== undefined ? formatUsd(e.priceUsd) : "—"}
                {e.maxDeviationBps !== undefined && (
                  <span className="text-fg-mute ml-3">
                    max deviation {e.maxDeviationBps.toFixed(0)}bps
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-baseline gap-3 mt-0.5">
            {e.reasonHash && (
              <span className="mono text-[10px] text-fg-mute">
                {formatHash(e.reasonHash, 6, 6)}
              </span>
            )}
            {hasReasoning && (
              <button
                className="mono text-[10px] text-coral hover:underline flex items-center gap-1"
                onClick={() => setOpen((o) => !o)}
              >
                {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                agent reasoning
              </button>
            )}
          </div>
          {hasReasoning && open && (
            <div className="mt-2 p-3 rounded-[8px] bg-surface-2 border border-border text-xs leading-relaxed text-fg-dim">
              {e.reasoning}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function SkeletonList() {
  return (
    <ol className="divide-y divide-border">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="py-3 flex items-start gap-3 opacity-40">
          <div className="w-3.5 h-3.5 rounded-full bg-border mt-0.5" />
          <div className="flex-1">
            <div className="h-3 w-32 bg-border rounded" />
            <div className="h-3 w-48 bg-border rounded mt-2" />
          </div>
        </li>
      ))}
    </ol>
  );
}
