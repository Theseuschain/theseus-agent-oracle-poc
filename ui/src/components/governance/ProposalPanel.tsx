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
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
          proposal #{p.proposalId}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
          {presetLabel}
        </span>
      </div>
      <p className="serif mt-2 text-[22px] leading-snug tracking-tight">
        {p.title}
      </p>

      <p className="mt-4 text-[13px] leading-[1.7] text-fg-mute">
        {p.summary}
      </p>

      <div className="mt-5 border-t border-border pt-3">
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
          calldata
        </p>
        <p className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.6] text-fg-mute">
          {p.calldataSummary}
        </p>
      </div>

      <div className="mt-6 border-t border-border">
        <Row
          label="treasury"
          value={`$${(p.treasuryUsd / 1e6).toFixed(0)}M`}
        />
        <Row
          label="value at risk"
          value={`$${(p.proposalValueAtRiskUsd / 1e6).toFixed(2)}M`}
          sub={`${valueAtRiskPct}% of treasury`}
          flag={p.proposalValueAtRiskUsd / p.treasuryUsd > 0.05}
        />
        <Row
          label="touches admin fns"
          value={p.touchesAdminFns ? "yes" : "no"}
          flag={p.touchesAdminFns}
        />
        <Row
          label="voting window"
          value={`${p.votingWindowHours}h`}
          flag={p.votingWindowHours < 48}
        />
        <Row
          label="participating supply"
          value={`${participatingPct}%`}
          sub={`${(p.participatingSupply / 1e6).toFixed(0)}M / ${(p.totalSupply / 1e6).toFixed(0)}M`}
        />
        <Row
          label="proposer share"
          value={`${proposerSharePct}%`}
          sub={p.proposerStakeNew24h ? "acquired in last 24h" : "long-held"}
          flag={p.proposerStakeNew24h}
        />
      </div>

      {p.recentFlashloanVotes && (
        <p
          className="mt-4 text-[12px] leading-[1.7]"
          style={{ color: "var(--coral)" }}
        >
          flash-loan-shaped vote in past hour: a position that opened and
          closed inside one transaction cast a majority of the YES votes.
          This is the Beanstalk shape.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  flag,
}: {
  label: string;
  value: string;
  sub?: string;
  flag?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 text-[12.5px] last:border-b-0">
      <span className="text-fg-mute">{label}</span>
      <span className="flex items-baseline gap-3 text-right">
        {sub && <span className="font-mono text-[11px] text-fg-mute">{sub}</span>}
        <span
          className="font-mono tnum"
          style={{ color: flag ? "var(--coral)" : "var(--fg)" }}
        >
          {value}
        </span>
      </span>
    </div>
  );
}
