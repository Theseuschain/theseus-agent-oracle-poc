"use client";

import { useState } from "react";
import { TimelineEntry, AgentInspect, VenueReading } from "@/lib/types";
import { aaveCounterfactual } from "@/lib/counterfactual";
import { formatBlock, formatHash, formatUsd } from "@/lib/format";
import { useTypewriter } from "@/lib/use-typewriter";

interface Props {
  entries: TimelineEntry[];
  loading?: boolean;
}

export function DecisionTimeline({ entries, loading }: Props) {
  if (loading && entries.length === 0) {
    return (
      <p className="font-mono text-[11px] text-fg-mute">loading…</p>
    );
  }
  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-fg-mute">
        Try a manipulation above. The agent&apos;s verdict and reasoning will
        appear here.
      </p>
    );
  }
  return (
    <ol>
      {entries.map((e, i) => (
        <TimelineRow key={`${e.block}-${i}`} entry={e} />
      ))}
    </ol>
  );
}

function reasoningOneLiner(reasoning: string | undefined): string | undefined {
  if (!reasoning) return undefined;
  const parts = reasoning.split(/(?<=[.!?])\s+/);
  if (parts.length === 0) return undefined;
  const first = parts[0].trim();
  if (first.length < 40 && parts.length > 1) {
    return parts.slice(0, 2).join(" ").trim();
  }
  return first;
}

function TimelineRow({ entry: e }: { entry: TimelineEntry }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const isPending = !!e.pending;
  const hasReasoning = !isPending && !!e.reasoning;
  const hasInspect = !isPending && !!e.inspect;

  const typedReasoning = useTypewriter(e.reasoning ?? "");
  const typewriterCaughtUp =
    !!e.reasoning && typedReasoning.length >= e.reasoning.length;
  const stillTyping = !!e.reasoning && !typewriterCaughtUp;
  const oneLiner =
    isPending || stillTyping ? undefined : reasoningOneLiner(e.reasoning);

  const cf =
    !isPending && e.inspect
      ? aaveCounterfactual(
          e.inspect.venues,
          e.inspect.referencePrice,
          e.decision,
          e.priceUsd,
        )
      : null;

  const refused = e.decision === "REFUSED";

  return (
    <li className="border-b border-border py-4 last:border-b-0">
      <div className="flex items-baseline gap-3 text-[12px]">
        <span className="font-mono text-fg-mute">
          block {formatBlock(e.block)}
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
            style={{ color: refused ? "var(--coral)" : "var(--green)" }}
          >
            {refused ? "refused" : "priced"}
          </span>
        )}
        {!isPending && (
          <span className="font-mono tnum text-fg">
            {refused ? (
              <span className="text-fg-mute">{e.reason ?? "venue divergence"}</span>
            ) : (
              <>
                {e.priceUsd !== undefined ? formatUsd(e.priceUsd) : "–"}
                {e.maxDeviationBps !== undefined && (
                  <span className="ml-3 text-fg-mute">
                    max deviation {e.maxDeviationBps.toFixed(0)}bps
                  </span>
                )}
              </>
            )}
          </span>
        )}
      </div>
      {isPending && !e.reasoning && (
        <p className="mt-1 text-[12px] italic text-fg-mute">
          The agent is reading the venues…
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
      {cf && cf.divergesFromAgent && (
        <p className="mt-2 text-[11.5px] text-fg-mute">{cf.costSummary}</p>
      )}
      {!isPending && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[10.5px] text-fg-mute">
          {e.reasonHash && (
            <span>{formatHash(e.reasonHash, 6, 6)}</span>
          )}
          {hasReasoning && (
            <button
              type="button"
              onClick={() => setReasoningOpen((o) => !o)}
              className="transition-colors hover:text-fg hover:underline"
            >
              {reasoningOpen ? "hide" : "full"} reasoning
            </button>
          )}
          {hasInspect && (
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
      {hasReasoning && reasoningOpen && (
        <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-mute">
          {e.reasoning}
        </p>
      )}
      {hasInspect && inspectOpen && e.inspect && (
        <InspectPanel inspect={e.inspect} />
      )}
    </li>
  );
}

function InspectPanel({ inspect }: { inspect: AgentInspect }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  return (
    <div className="mt-3 border-l-2 border-border pl-4 text-[11.5px] text-fg-mute">
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        what the agent saw
      </p>
      <ul className="mt-2 space-y-1 font-mono text-[10.5px]">
        {inspect.venues.map((v) => (
          <VenueLine key={v.venue} v={v} />
        ))}
      </ul>
      <p className="mt-2 font-mono text-[10.5px]">
        reference price (pre-tamper):{" "}
        <span className="text-fg tnum">
          {inspect.referencePrice > 0 ? formatUsd(inspect.referencePrice) : "–"}
        </span>
      </p>
      {inspect.prompt && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowPrompt((o) => !o)}
            className="font-mono text-[10.5px] transition-colors hover:text-fg hover:underline"
          >
            {showPrompt ? "hide" : "show"} prompt · {inspect.model ?? "deepseek-chat"}
            {inspect.latencyMs !== undefined && ` · ${inspect.latencyMs}ms`}
          </button>
          {showPrompt && (
            <div className="mt-2 space-y-2">
              <PromptBlock label="system" text={inspect.prompt.system} />
              <PromptBlock label="user" text={inspect.prompt.user} />
            </div>
          )}
        </div>
      )}
      {inspect.rawResponse && (
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
              {prettyJson(inspect.rawResponse)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function VenueLine({ v }: { v: VenueReading }) {
  const tag = v.tampered ? " (overridden)" : "";
  return (
    <li className="flex flex-wrap items-baseline gap-2">
      <span className="w-16 uppercase tracking-wider text-fg-mute">{v.venue}</span>
      {v.ok ? (
        <>
          <span className="text-fg tnum">
            {formatUsd(v.priceUsd)}
            {tag}
          </span>
          <span className="text-fg-mute">
            depth{" "}
            <span className="text-fg tnum">
              {formatUsd(v.depthUsd, { compact: true, decimals: 1 })}
            </span>
          </span>
          <span>{v.ageSeconds}s ago</span>
        </>
      ) : (
        <span style={{ color: "var(--coral)" }}>
          {v.error ?? "unavailable"}
        </span>
      )}
    </li>
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

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
