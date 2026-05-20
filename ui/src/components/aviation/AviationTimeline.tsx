"use client";

import { useState } from "react";
import { CommitBadge } from "@/components/CommitBadge";
import { AviationTimelineEntry } from "@/lib/aviation-scenario";
import { useTypewriter } from "@/lib/use-typewriter";

interface Props {
  entries: AviationTimelineEntry[];
}

const POA_PROFILE =
  "https://theseus.network/poa/5JhT2nQ8eP6mY4dR1bL9wK3vF7cN5aZ8sH2gM6xV1oCb";

export function AviationTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-fg-mute">
        Pick a change above and click <span className="text-fg">run review</span>.
        The agent&apos;s verdict and reasoning will appear here.
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
  label: string;
  isCoral: boolean;
} {
  if (d === "APPROVE") return { label: "approved", isCoral: false };
  if (d === "REJECT") return { label: "rejected", isCoral: true };
  return { label: "caution", isCoral: true };
}

function Row({ entry }: { entry: AviationTimelineEntry }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  const isPending = !!entry.pending || !entry.verdict;
  const verdictMeta = decisionLabel(entry.verdict?.decision);

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
            style={{
              color: verdictMeta.isCoral ? "var(--coral)" : "var(--green)",
            }}
          >
            {verdictMeta.label}
          </span>
        )}
        <span className="font-mono text-fg">
          #{entry.changeSnapshot.changeId} {entry.changeSnapshot.title}
        </span>
        {entry.scenarioLabel && (
          <span className="font-mono text-[10.5px] text-fg-mute">
            · {entry.scenarioLabel}
          </span>
        )}
      </div>
      {entry.verdict && (
        <p className="mt-1 font-mono text-[12.5px] text-fg-mute break-words">
          {entry.verdict.reason}
        </p>
      )}
      {isPending && !entry.streamingReasoning && (
        <p className="mt-1 text-[12.5px] italic text-fg-mute">
          The agent is reading the change and safety signals…
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
        <p className="mt-1 text-[12.5px] italic text-fg-mute">
          &ldquo;{oneLiner}&rdquo;
        </p>
      )}
      {entry.verdict && (
        <>
          <p className="mt-2 text-[11.5px] leading-relaxed text-fg-mute">
            On Theseus, this advisory verdict is signed and verifiable —{" "}
            <a
              href={POA_PROFILE}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg"
            >
              check the proof
            </a>
            .
          </p>
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
        </>
      )}
      {reasoningOpen && entry.verdict && (
        <p className="mt-3 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-fg-mute">
          {entry.verdict.reasoning}
        </p>
      )}
      <CommitBadge commit={entry.commit} error={entry.commitError} />
      {inspectOpen && entry.verdict?.prompt && (
        <div className="mt-3 border-l-2 border-border pl-4">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              user message
            </p>
            <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10.5px] leading-snug text-fg-mute">
              {entry.verdict.prompt.user}
            </pre>
          </div>
          {entry.verdict.rawResponse && (
            <div className="mt-3">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                raw response
              </p>
              <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10.5px] leading-snug text-fg-mute">
                {entry.verdict.rawResponse}
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
