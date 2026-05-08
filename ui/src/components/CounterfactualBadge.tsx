"use client";

// Inline counterfactual surface for a timeline row. Communicates the
// alternative outcome (what a quorum oracle, or no-failsafe contract,
// would have done) in one glance, with severity-coded styling.

import { TrendingDown, AlertTriangle, Equal } from "lucide-react";

type Severity = "low" | "med" | "high";

interface Props {
  /** "Quorum oracle" for Aave, "Naive contract" for Terra. */
  altLabel: string;
  /** One-line description of the alternative's outcome. */
  summary: string;
  severity: Severity;
  /** When false, the agent and alternative agree, so the badge fades back. */
  divergesFromAgent: boolean;
}

export function CounterfactualBadge({
  altLabel,
  summary,
  severity,
  divergesFromAgent,
}: Props) {
  const palette =
    severity === "high"
      ? {
          border: "border-red/50",
          bg: "bg-red/10",
          text: "text-red",
          icon: <AlertTriangle size={11} />,
        }
      : severity === "med"
        ? {
            border: "border-amber/50",
            bg: "bg-amber/10",
            text: "text-amber",
            icon: <TrendingDown size={11} />,
          }
        : {
            border: "border-border",
            bg: "bg-surface-2",
            text: "text-fg-mute",
            icon: <Equal size={11} />,
          };
  const opacity = divergesFromAgent ? "" : "opacity-70";

  return (
    <div
      className={`mt-2 rounded-[8px] border ${palette.border} ${palette.bg} ${opacity} px-3 py-2 text-[11px] leading-relaxed`}
    >
      <div className={`flex items-center gap-1.5 mono uppercase tracking-wider text-[10px] ${palette.text} mb-1`}>
        {palette.icon}
        Without the agent · {altLabel}
      </div>
      <div className="text-fg-dim">{summary}</div>
    </div>
  );
}
