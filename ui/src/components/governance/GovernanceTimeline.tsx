"use client";

import { useState } from "react";
import { CommitBadge } from "@/components/CommitBadge";
import { GovernanceTimelineEntry } from "@/lib/governance-scenario";
import { useTypewriter } from "@/lib/use-typewriter";

interface Props {
  entries: GovernanceTimelineEntry[];
}

export function GovernanceTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-fg-mute">
        Load a proposal above and run the review. The agent&apos;s verdict
        and reasoning will appear here.
      </p>
    );
  }
  return (
    <ol>
      {entries.map((e, i) => (
        <Row key={`${e.block}-${i}`} entry={e} />
      ))}
    </ol>
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

function decisionLabel(d?: "APPROVE" | "CAUTION" | "REJECT"): {
  text: string;
  refused: boolean;
} {
  if (d === "APPROVE") return { text: "approve", refused: false };
  if (d === "REJECT") return { text: "reject", refused: true };
  return { text: "caution", refused: true };
}

function Row({ entry }: { entry: GovernanceTimelineEntry }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  const isPending = !!entry.pending || !entry.verdict;
  const label = decisionLabel(entry.verdict?.decision);

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
    <li className="border-b border-border py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px]">
        <span className="font-mono text-fg-mute">
          block {entry.block.toLocaleString()}
        </span>
        {isPending ? (
          <span
            className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
            style={{ color: "var(--coral)" }}
          >
            reasoning…
          </span>
        ) : (
          <span
            className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em]"
            style={{ color: label.refused ? "var(--coral)" : "var(--green)" }}
          >
            {label.text}
          </span>
        )}
        <span className="font-mono text-fg-mute">
          #{entry.proposalSnapshot.proposalId} {entry.proposalSnapshot.title}
        </span>
        {entry.scenarioLabel && (
          <span className="font-mono text-[10.5px] text-fg-mute">
            · {entry.scenarioLabel}
          </span>
        )}
      </div>

      {entry.verdict && (
        <p className="mt-1 font-mono text-[12px] text-fg-mute">
          {entry.verdict.reason}
        </p>
      )}

      {isPending && !entry.streamingReasoning && (
        <p className="mt-1 text-[12px] italic text-fg-mute">
          The agent is reading the proposal and calldata…
        </p>
      )}
      {(isPending || stillTyping) && typedReasoning && (
        <p className="mt-1 text-[12.5px] italic text-fg-mute">
          {typedReasoning}
          {!typewriterCaughtUp && (
            <span
              className="ml-0.5 inline-block h-[1em] w-[6px] animate-pulse align-text-bottom"
              style={{ background: "var(--coral)" }}
            />
          )}
        </p>
      )}
      {!isPending && !stillTyping && oneLiner && (
        <p className="mt-1 text-[12.5px] italic text-fg-mute">“{oneLiner}”</p>
      )}

      {!isPending && entry.verdict && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[10.5px] text-fg-mute">
          <button
            type="button"
            onClick={() => setReasoningOpen((o) => !o)}
            className="transition-colors hover:text-fg hover:underline"
          >
            {reasoningOpen ? "hide" : "full"} reasoning
          </button>
          {entry.verdict.prompt && (
            <button
              type="button"
              onClick={() => setInspectOpen((o) => !o)}
              className="transition-colors hover:text-fg hover:underline"
            >
              {inspectOpen ? "hide" : "inspect"} input/output
            </button>
          )}
        </div>
      )}

      {reasoningOpen && entry.verdict && (
        <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-mute">
          {entry.verdict.reasoning}
        </p>
      )}

      <CommitBadge commit={entry.commit} error={entry.commitError} />

      {inspectOpen && entry.verdict?.prompt && (
        <div className="mt-3 border-l-2 border-border pl-4 text-[11.5px] text-fg-mute">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
            user message sent to model
          </p>
          <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-fg-mute">
            {entry.verdict.prompt.user}
          </pre>
          {entry.verdict.rawResponse && (
            <>
              <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                raw model response
              </p>
              <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-fg-mute">
                {entry.verdict.rawResponse}
              </pre>
            </>
          )}
        </div>
      )}
    </li>
  );
}
