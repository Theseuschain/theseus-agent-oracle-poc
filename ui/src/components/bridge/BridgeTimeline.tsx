"use client";

import { useState } from "react";
import { CommitBadge } from "@/components/CommitBadge";
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
  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-fg-mute">
        Load a source-chain state above and click release. The agent&apos;s
        verdict, its one-line reasoning, and what a naive bridge would have
        done will appear here.
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
// observation. With the scratchpad-via-JSON prompt pattern the reasoning
// walks through ordered checks before committing; the verdict and its
// load-bearing rationale are in the last sentences.
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
  const refused = !isPending && !allowed;

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
    <li className="border-b border-border py-4 last:border-b-0">
      <div className="flex items-baseline gap-3 text-[12px]">
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
            className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
            style={{ color: refused ? "var(--coral)" : "var(--fg)" }}
          >
            {allowed ? "allow" : "refuse"}
          </span>
        )}
        <span className="font-mono tnum text-fg">
          withdraw ${entry.amountUsd.toLocaleString()}
        </span>
        {entry.scenarioLabel && (
          <span className="font-mono text-[10.5px] text-fg-mute">
            · {entry.scenarioLabel}
          </span>
        )}
      </div>

      {entry.verdict && (
        <p className="mt-1 font-mono text-[12.5px] text-fg-mute">
          {entry.verdict.reason}
        </p>
      )}
      {isPending && !entry.streamingReasoning && (
        <p className="mt-1 text-[12.5px] italic text-fg-mute">
          The agent is reading the source-chain state…
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
      {cf && (
        <>
          <CounterfactualBadge
            altLabel="naive bridge (no guardian)"
            summary={cf.costSummary}
            severity={cf.severity}
            divergesFromAgent={cf.divergesFromAgent}
          />
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-mute">
            On Theseus, this entire reasoning bundle is signed and verifiable.
            You don&rsquo;t have to trust the operator;{" "}
            <a
              href={POA_PROFILE}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg"
              style={{ color: "var(--coral)" }}
            >
              check the proof
            </a>
            .
          </p>
        </>
      )}

      {entry.verdict && (
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
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("bridge-scenarios");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
              } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="ml-auto transition-colors hover:text-fg hover:underline"
          >
            try another scenario ↑
          </button>
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
          <p className="font-mono text-[10.5px] text-fg-mute">
            user message sent to model:
          </p>
          <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-fg-mute">
            {entry.verdict.prompt.user}
          </pre>
          {entry.verdict.rawResponse && (
            <>
              <p className="mt-3 font-mono text-[10.5px] text-fg-mute">
                raw model response:
              </p>
              <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-fg-mute">
                {entry.verdict.rawResponse}
              </pre>
            </>
          )}
        </div>
      )}
    </li>
  );
}
