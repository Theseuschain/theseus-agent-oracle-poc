"use client";

import { useState } from "react";
import { CommitBadge } from "@/components/CommitBadge";
import {
  CircleCheck,
  CircleX,
  ChevronDown,
  ChevronRight,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import { BridgeTimelineEntry } from "@/lib/bridge-scenario";
import { useTypewriter } from "@/lib/use-typewriter";
import { CounterfactualBadge } from "../CounterfactualBadge";
import { bridgeCounterfactual } from "@/lib/bridge-counterfactual";

interface Props {
  entries: BridgeTimelineEntry[];
}

const POA_PROFILE =
  "https://theseus.network/poa/5KbR9w3jH8mTcQ2nL5pY7eB1xK4dV6sN8aZ3fW5tH9pM1vXc";

export function BridgeTimeline({ entries }: Props) {
  return (
    <div className="surface p-4 sm:p-6 lg:col-span-3">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1">Guardian verdicts</div>
          <div className="serif text-lg">Release timeline</div>
        </div>
        <span className="text-fg-mute mono text-[10px]">
          {entries.length} action{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="text-fg-dim text-sm py-8 text-center max-w-md mx-auto leading-relaxed">
          Load a source-chain state above and click{" "}
          <span className="text-fg">Release</span>. The agent&apos;s verdict,
          its one-line reasoning, and what a naive bridge would have done land
          here.
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
// observation. With the scratchpad-via-JSON prompt pattern the reasoning
// walks through ordered checks before committing; the verdict and its
// load-bearing rationale are in the last sentences. Find the verdict
// verb (Refusing / Allowing / Approving / Cautioning / Rejecting /
// Pricing) and walk backwards until we have enough context to be
// informative.
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

function Row({ entry }: { entry: BridgeTimelineEntry }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  const isPending = !!entry.pending || !entry.verdict;
  const allowed = !isPending && entry.verdict?.decision === "ALLOW";

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

  const cf = entry.verdict
    ? bridgeCounterfactual(entry.stateSnapshot, entry.amountUsd, entry.verdict)
    : null;

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          {isPending ? (
            <Loader2 size={14} className="text-coral animate-spin" />
          ) : allowed ? (
            <CircleCheck size={14} className="text-green" />
          ) : (
            <CircleX size={14} className="text-red" />
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
                className={`mono text-[11px] uppercase tracking-wider ${
                  allowed ? "text-green" : "text-red"
                }`}
              >
                {allowed ? "allow" : "refuse"}
              </span>
            )}
            <span className="mono text-[11px] text-fg">
              WITHDRAW ${entry.amountUsd.toLocaleString()}
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
              The agent is reading the source-chain state…
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
          {cf && (
            <>
              <CounterfactualBadge
                altLabel="naive bridge (no guardian)"
                summary={cf.costSummary}
                severity={cf.severity}
                divergesFromAgent={cf.divergesFromAgent}
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-fg-dim">
                On Theseus, this entire reasoning bundle is signed and
                verifiable. You don&rsquo;t have to trust the operator;{" "}
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
            </>
          )}
          {entry.verdict && (
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
                  const el = document.getElementById("bridge-scenarios");
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
