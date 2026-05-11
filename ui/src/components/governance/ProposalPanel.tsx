"use client";

import { ProposalState } from "@/lib/governance-scenario";

interface Props {
  proposal: ProposalState;
  presetLabel: string;
}

export function ProposalPanel({ proposal: p, presetLabel }: Props) {
  const valueAtRiskPct = ((p.proposalValueAtRiskUsd / p.treasuryUsd) * 100).toFixed(1);
  const participatingPct = ((p.participatingSupply / p.totalSupply) * 100).toFixed(1);
  const proposerSharePct = (p.proposerSharePct * 100).toFixed(2);

  return (
    <div className="surface p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="eyebrow mb-1">Proposal #{p.proposalId}</div>
          <div className="serif text-2xl leading-snug">{p.title}</div>
        </div>
        <span className="badge badge-stale">{presetLabel}</span>
      </div>

      <div className="mb-4">
        <div className="eyebrow mb-1.5">Summary (marketing pitch)</div>
        <p className="text-sm leading-relaxed text-fg-dim">{p.summary}</p>
      </div>

      <div className="mb-5 rounded-[8px] border border-border bg-surface-2 p-3">
        <div className="eyebrow mb-1.5">Calldata (what the tx actually does)</div>
        <p className="mono text-[12px] leading-relaxed text-fg-dim whitespace-pre-wrap break-words">
          {p.calldataSummary}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
        <Stat
          label="Treasury"
          value={`$${(p.treasuryUsd / 1e6).toFixed(0)}M`}
        />
        <Stat
          label="Value at risk"
          value={`$${(p.proposalValueAtRiskUsd / 1e6).toFixed(2)}M`}
          sub={`${valueAtRiskPct}% of treasury`}
          health={
            p.proposalValueAtRiskUsd / p.treasuryUsd > 0.25
              ? "crit"
              : p.proposalValueAtRiskUsd / p.treasuryUsd > 0.05
                ? "warn"
                : "ok"
          }
        />
        <Stat
          label="Touches admin fns"
          value={p.touchesAdminFns ? "yes" : "no"}
          health={p.touchesAdminFns ? "crit" : "ok"}
        />
        <Stat
          label="Voting window"
          value={`${p.votingWindowHours}h`}
          health={
            p.votingWindowHours < 24 ? "crit" : p.votingWindowHours < 48 ? "warn" : "ok"
          }
        />
        <Stat
          label="Participating supply"
          value={`${participatingPct}%`}
          sub={`${(p.participatingSupply / 1e6).toFixed(0)}M / ${(p.totalSupply / 1e6).toFixed(0)}M`}
        />
        <Stat
          label="Proposer share"
          value={`${proposerSharePct}%`}
          sub={
            p.proposerStakeNew24h
              ? "acquired in last 24h"
              : "long-held"
          }
          health={
            p.proposerStakeNew24h && p.proposerSharePct > 0.1
              ? "crit"
              : p.proposerStakeNew24h
                ? "warn"
                : "ok"
          }
        />
      </div>

      {p.recentFlashloanVotes && (
        <div className="mt-4 rounded-[8px] border border-red/40 bg-red/5 p-3">
          <div className="mono text-[10px] uppercase tracking-wider text-red mb-1">
            flash-loan-shaped vote in past hour
          </div>
          <p className="text-[12px] text-fg-dim leading-relaxed">
            A position that opened and closed inside one transaction cast a
            majority of the YES votes. This is the Beanstalk shape.
          </p>
        </div>
      )}
    </div>
  );
}

type Health = "ok" | "warn" | "crit";

function healthColor(h?: Health): string {
  if (h === "crit") return "text-red";
  if (h === "warn") return "text-amber";
  return "text-green";
}

function Stat({
  label,
  value,
  sub,
  health,
}: {
  label: string;
  value: string;
  sub?: string;
  health?: Health;
}) {
  return (
    <div>
      <div className="eyebrow mb-0.5">{label}</div>
      <div className="mono text-sm tnum text-fg">{value}</div>
      {sub && (
        <div className={`mono text-[10px] ${healthColor(health) || "text-fg-mute"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
