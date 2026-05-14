"use client";

import { useState } from "react";
import { CommitBadge } from "@/components/CommitBadge";
import {
  CircleCheck,
  CircleX,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import { GovernanceTimelineEntry } from "@/lib/governance-scenario";
import { useTypewriter } from "@/lib/use-typewriter";

interface Props {
  entries: GovernanceTimelineEntry[];
}

const POA_PROFILE =
  "https://theseus.network/poa/5FmN8vY6cP1qK4xR7zL3jB9wE5dV8aS2hT6gM3fX9pZ7nCk2";

export function GovernanceTimeline({ entries }: Props) {
  return (
    <div className="surface p-4 sm:p-6 lg:col-span-3">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1">Reviewer verdicts</div>
          <div className="serif text-lg">Proposal timeline</div>
        </div>
        <span className="text-fg-mute mono text-[10px]">
          {entries.length} review{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="text-fg-dim text-sm py-8 text-center max-w-md mx-auto leading-relaxed">
          Load a proposal above and click{" "}
          <span className="text-fg">Run review</span>. The agent&apos;s
          verdict and reasoning will land here, signed and ready for voters
          to inspect.
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {entries.map((e, i) => (
            <Row key={`${e.block}-${i}`} entry={e} />
          ))}
        </ol>
      )}
    </div>
  );
}

// Surface the agent's CONCLUSION as the one-liner, not its first
// observation. Find the verdict verb and walk backwards for context.
function reasoningOneLiner(reasoning: string): string | undefined {
  const sentences = reasoning
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return undefined;
  const verdictVerbs =
    /\b(Refusing|Allowing|Approving|Cautioning|Rejecting|Pricing)\b/;
  let endIdx = sentences.length - 1;
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (verdictVerbs.test(sentences[i])) {
      endIdx = i;
      break;
    }
  }
  const parts: string[] = [sentences[endIdx]];
  let i = endIdx - 1;
  while (i >= 0 && parts.join(" ").length < 120) {
    parts.unshift(sentences[i]);
    i--;
  }
  return parts.join(" ");
}

function decisionPalette(d?: "APPROVE" | "CAUTION" | "REJECT"): {
  icon: typeof CircleCheck;
  color: string;
  label: string;
} {
  if (d === "APPROVE") {
    return { icon: CircleCheck, color: "text-green", label: "approve" };
  }
  if (d === "REJECT") {
    return { icon: CircleX, color: "text-red", label: "reject" };
  }
  return { icon: CircleAlert, color: "text-amber", label: "caution" };
}

function Row({ entry }: { entry: GovernanceTimelineEntry }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  const isPending = !!entry.pending || !entry.verdict;
  const palette = decisionPalette(entry.verdict?.decision);
  const Icon = palette.icon;

  const reasoningText =
    entry.streamingReasoning ?? entry.verdict?.reasoning ?? "";
  const typedReasoning = useTypewriter(reasoningText);
  const typewriterCaughtUp =
    !!reasoningText && typedReasoning.length >= reasoningText.length;
  const stillTyping = !!reasoningText && !typewriterCaughtUp;

  const oneLiner =
    !isPending && !stillTyping && entry.verdict
      ? reasoningOneLiner(entry.verdict.reasoning)
      : undefined;

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          {isPending ? (
            <Loader2 size={14} className="text-coral animate-spin" />
          ) : (
            <Icon size={14} className={palette.color} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="mono text-[11px] text-fg-mute">
              block {entry.block.toLocaleString()}
            </span>
            {isPending ? (
              <span className="mono text-[11px] text-coral pulse-coral rounded-full px-2 py-0.5 border border-coral/40">
                agent reasoning…
              </span>
            ) : (
              <span
                className={`mono text-[11px] uppercase tracking-wider ${palette.color}`}
              >
                {palette.label}
              </span>
            )}
            <span className="mono text-[11px] text-fg">
              #{entry.proposalSnapshot.proposalId} {entry.proposalSnapshot.title}
            </span>
            {entry.scenarioLabel && (
              <span className="mono text-[10px] text-fg-mute">
                · {entry.scenarioLabel}
              </span>
            )}
          </div>
          {entry.verdict && (
            <div className="mono text-sm text-fg-dim mt-0.5 break-words">
              {entry.verdict.reason}
            </div>
          )}
          {isPending && !entry.streamingReasoning && (
            <div className="mt-1.5 text-[12px] leading-relaxed text-fg-mute italic">
              The agent is reading the proposal and calldata…
            </div>
          )}
          {(isPending || stillTyping) && typedReasoning && (
            <div className="mt-1.5 text-[12px] leading-relaxed text-fg-dim">
              <span className="italic">{typedReasoning}</span>
              {!typewriterCaughtUp && (
                <span className="ml-0.5 inline-block w-[6px] h-[1em] bg-coral align-text-bottom animate-pulse" />
              )}
            </div>
          )}
          {!isPending && !stillTyping && oneLiner && (
            <div className="mt-1.5 text-[12px] leading-relaxed text-fg-dim italic">
              &ldquo;{oneLiner}&rdquo;
            </div>
          )}
          {entry.verdict && (
            <>
              <p className="mt-2 text-[11px] leading-relaxed text-fg-dim">
                On Theseus, this advisory verdict is signed and verifiable.
                Voters don&rsquo;t have to trust the operator;{" "}
                <a
                  href={POA_PROFILE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-coral hover:underline"
                >
                  check the proof
                </a>
                .
              </p>
              <div className="flex items-baseline gap-3 mt-2 flex-wrap">
                <button
                  className="mono text-[10px] text-coral hover:underline flex items-center gap-1"
                  onClick={() => setReasoningOpen((o) => !o)}
                >
                  {reasoningOpen ? (
                    <ChevronDown size={10} />
                  ) : (
                    <ChevronRight size={10} />
                  )}
                  full reasoning
                </button>
                {entry.verdict.prompt && (
                  <button
                    className="mono text-[10px] text-fg-dim hover:text-fg flex items-center gap-1"
                    onClick={() => setInspectOpen((o) => !o)}
                  >
                    {inspectOpen ? (
                      <ChevronDown size={10} />
                    ) : (
                      <ChevronRight size={10} />
                    )}
                    inspect input/output
                  </button>
                )}
                <button
                  className="mono text-[10px] text-fg-dim hover:text-coral flex items-center gap-1 ml-auto"
                  onClick={() => {
                    const el = document.getElementById("governance-scenarios");
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                    } else {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                >
                  try another scenario <ArrowUpRight size={10} />
                </button>
              </div>
            </>
          )}
          {reasoningOpen && entry.verdict && (
            <div className="mt-2 p-3 rounded-[8px] bg-surface-2 border border-border text-xs leading-relaxed text-fg-dim whitespace-pre-wrap break-words">
              {entry.verdict.reasoning}
            </div>
          )}
          <CommitBadge commit={entry.commit} error={entry.commitError} />
          {inspectOpen && entry.verdict?.prompt && (
            <div className="mt-2 grid grid-cols-1 gap-2">
              <details className="p-3 rounded-[8px] bg-surface-2 border border-border">
                <summary className="mono text-[10px] uppercase tracking-wider text-fg-mute cursor-pointer">
                  user message sent to model
                </summary>
                <pre className="mt-2 text-[11px] whitespace-pre-wrap text-fg-dim">
                  {entry.verdict.prompt.user}
                </pre>
              </details>
              {entry.verdict.rawResponse && (
                <details className="p-3 rounded-[8px] bg-surface-2 border border-border">
                  <summary className="mono text-[10px] uppercase tracking-wider text-fg-mute cursor-pointer">
                    raw model response
                  </summary>
                  <pre className="mt-2 text-[11px] whitespace-pre-wrap text-fg-dim">
                    {entry.verdict.rawResponse}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
