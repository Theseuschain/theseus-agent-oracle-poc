"use client";

import { useState } from "react";
import { CommitBadge } from "@/components/CommitBadge";
import { TimelineEntry } from "@/lib/terra-scenario";
import { terraCounterfactual } from "@/lib/counterfactual";
import { useTypewriter } from "@/lib/use-typewriter";

interface Props {
  entries: TimelineEntry[];
  pending?: boolean;
}

export function TerraTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-fg-mute">
        Load a vault state above and try mint or redeem. The agent&apos;s
        verdict and reasoning will appear here.
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
// observation. With the scratchpad-via-JSON prompt pattern, the
// verdict and its load-bearing rationale live in the last sentences.
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

function Row({ entry }: { entry: TimelineEntry }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  const isPending = !!entry.pending || !entry.verdict;
  const allowed = !isPending && entry.verdict?.decision === "ALLOW";

  // Single source of truth for the reasoning text: streaming partial
  // while the LLM call is in flight, then the final once it lands.
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
    ? terraCounterfactual(
        entry.vaultSnapshot,
        entry.action,
        entry.ustdAmount,
        entry.verdict,
      )
    : null;

  return (
    <li className="border-b border-border py-4 last:border-b-0">
      <div className="flex items-baseline gap-3 text-[12px] flex-wrap">
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
            style={{ color: allowed ? "var(--green)" : "var(--coral)" }}
          >
            {allowed ? "allow" : "refuse"}
          </span>
        )}
        <span className="font-mono tnum text-fg">
          {entry.action.toLowerCase()} {entry.ustdAmount.toLocaleString()} USTD
        </span>
        {entry.scenarioLabel && (
          <span className="font-mono text-[10.5px] text-fg-mute">
            · {entry.scenarioLabel.toLowerCase()}
          </span>
        )}
      </div>
      {entry.verdict && (
        <p className="mt-1 text-[12.5px] text-fg-mute">{entry.verdict.reason}</p>
      )}
      {isPending && !entry.streamingReasoning && (
        <p className="mt-1 text-[12px] italic text-fg-mute">
          The agent is reading the vault metrics…
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
      {cf && cf.divergesFromAgent && (
        <p className="mt-2 text-[11.5px] text-fg-mute">
          without the agent: {cf.costSummary}
        </p>
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
          {(entry.verdict.prompt || entry.vaultSnapshot) && (
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
      {inspectOpen && entry.verdict && <Inspect entry={entry} />}
    </li>
  );
}

function Inspect({ entry }: { entry: TimelineEntry }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const v = entry.vaultSnapshot;

  return (
    <div className="mt-3 border-l-2 border-border pl-4 text-[11.5px] text-fg-mute">
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        what the agent saw
      </p>
      <ul className="mt-2 space-y-1 font-mono text-[10.5px]">
        <li>
          USTD median{" "}
          <span className="text-fg tnum">${v.ustdMedianUsd.toFixed(3)}</span>{" "}
          ({((1 - v.ustdMedianUsd) * 10000).toFixed(0)}bps below peg)
        </li>
        <li>
          redemption rate{" "}
          <span className="text-fg tnum">
            {(v.redemptionRate1h * 100).toFixed(2)}%/h
          </span>
        </li>
        <li>
          LUND supply growth 24h{" "}
          <span className="text-fg tnum">
            {((v.lundSupplyGrowth24h - 1) * 100).toFixed(1)}%
          </span>
        </li>
        <li>
          LUND price 24h{" "}
          <span className="text-fg tnum">
            {((v.lundPriceChange24h - 1) * 100).toFixed(1)}%
          </span>
        </li>
        <li>
          reserves{" "}
          <span className="text-fg tnum">
            {(v.reserveCoverage * 100).toFixed(1)}%
          </span>{" "}
          of supply
        </li>
      </ul>
      {entry.verdict?.prompt && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowPrompt((o) => !o)}
            className="font-mono text-[10.5px] transition-colors hover:text-fg hover:underline"
          >
            {showPrompt ? "hide" : "show"} prompt ·{" "}
            {entry.verdict.model ?? "deepseek-chat"}
            {entry.verdict.latencyMs !== undefined &&
              ` · ${entry.verdict.latencyMs}ms`}
          </button>
          {showPrompt && (
            <div className="mt-2 space-y-2">
              <PromptBlock label="system" text={entry.verdict.prompt.system} />
              <PromptBlock label="user" text={entry.verdict.prompt.user} />
            </div>
          )}
        </div>
      )}
      {entry.verdict?.rawResponse && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowResponse((o) => !o)}
            className="font-mono text-[10.5px] transition-colors hover:text-fg hover:underline"
          >
            {showResponse ? "hide" : "show"} raw response
          </button>
          {showResponse && (
            <pre className="mt-2 max-h-96 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-snug text-fg-mute">
              {pretty(entry.verdict.rawResponse)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] text-fg-mute">{label}:</p>
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-fg-mute">
        {text}
      </pre>
    </div>
  );
}

function pretty(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
