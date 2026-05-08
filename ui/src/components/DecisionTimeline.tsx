"use client";

import { useState } from "react";
import { TimelineEntry, AgentInspect, VenueReading } from "@/lib/types";
import { aaveCounterfactual } from "@/lib/counterfactual";
import { formatBlock, formatHash, formatUsd } from "@/lib/format";
import { useTypewriter } from "@/lib/use-typewriter";
import { CircleCheck, CircleX, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { CounterfactualBadge } from "./CounterfactualBadge";

interface Props {
  entries: TimelineEntry[];
  loading?: boolean;
}

export function DecisionTimeline({ entries, loading }: Props) {
  return (
    <div className="surface p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="serif text-lg">Agent timeline</div>
        {entries.length > 0 && (
          <span className="text-fg-mute mono text-[10px]">
            last {entries.length} runs
          </span>
        )}
      </div>

      {loading && entries.length === 0 ? (
        <SkeletonList />
      ) : entries.length === 0 ? (
        <div className="text-fg-dim text-sm py-8 text-center max-w-md mx-auto leading-relaxed">
          Try a manipulation lever above. The agent&apos;s verdict, reasoning,
          and the counterfactual outcome will show up here.
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {entries.map((e, i) => (
            <TimelineRow
              key={`${e.block}-${i}`}
              entry={e}
              defaultReasoningOpen={false}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

/** Pulls the most informative single sentence from a multi-sentence
 *  reasoning paragraph. Prefers the first one that names a specific
 *  signal; falls back to first sentence. */
function reasoningOneLiner(reasoning: string | undefined): string | undefined {
  if (!reasoning) return undefined;
  // Split on sentence boundaries, keeping the trailing punctuation. The
  // first sentence almost always carries the cause of the verdict.
  const parts = reasoning.split(/(?<=[.!?])\s+/);
  if (parts.length === 0) return undefined;
  const first = parts[0].trim();
  // Some reasonings start with "You decide PRICED or REFUSED." style
  // boilerplate; skip past that.
  if (first.length < 40 && parts.length > 1) {
    return parts.slice(0, 2).join(" ").trim();
  }
  return first;
}

function TimelineRow({
  entry: e,
  defaultReasoningOpen,
}: {
  entry: TimelineEntry;
  defaultReasoningOpen: boolean;
}) {
  const [reasoningOpen, setReasoningOpen] = useState(defaultReasoningOpen);
  const [inspectOpen, setInspectOpen] = useState(false);
  const isPending = !!e.pending;
  const hasReasoning = !isPending && !!e.reasoning;
  const hasInspect = !isPending && !!e.inspect;

  // Animate the reasoning text at a readable pace. The streaming text
  // (during pending) and the final reasoning (after) flow through the
  // same typewriter, so the transition stays smooth.
  const typedReasoning = useTypewriter(e.reasoning ?? "");
  const typewriterCaughtUp =
    !!e.reasoning && typedReasoning.length >= e.reasoning.length;
  // While the typewriter is still catching up, keep showing the
  // animated text instead of the static one-liner, even after the
  // verdict has landed.
  const stillTyping = !!e.reasoning && !typewriterCaughtUp;
  const oneLiner =
    isPending || stillTyping ? undefined : reasoningOneLiner(e.reasoning);

  // Counterfactual: only meaningful for committed verdicts.
  const cf = !isPending && e.inspect
    ? aaveCounterfactual(
        e.inspect.venues,
        e.inspect.referencePrice,
        e.decision,
        e.priceUsd,
      )
    : null;

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          {isPending ? (
            <Loader2 size={14} className="text-coral animate-spin" />
          ) : e.decision === "REFUSED" ? (
            <CircleX size={14} className="text-red" />
          ) : (
            <CircleCheck size={14} className="text-green" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="mono text-[11px] text-fg-mute">
              block {formatBlock(e.block)}
            </span>
            {isPending ? (
              <span className="mono text-[11px] text-coral pulse-coral rounded-full px-2 py-0.5 border border-coral/40">
                agent reasoning…
              </span>
            ) : (
              <span
                className={`mono text-[11px] uppercase tracking-wider ${
                  e.decision === "REFUSED" ? "text-red" : "text-green"
                }`}
              >
                {e.decision === "REFUSED" ? "refused" : "priced"}
              </span>
            )}
          </div>
          {!isPending && (
            <div className="mono text-sm text-fg mt-0.5 tnum">
              {e.decision === "REFUSED" ? (
                <span className="text-fg-dim break-words">{e.reason ?? "venue divergence"}</span>
              ) : (
                <>
                  {e.priceUsd !== undefined ? formatUsd(e.priceUsd) : "–"}
                  {e.maxDeviationBps !== undefined && (
                    <span className="text-fg-mute ml-3">
                      max deviation {e.maxDeviationBps.toFixed(0)}bps
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          {isPending && !e.reasoning && (
            <div className="mt-1.5 text-[12px] leading-relaxed text-fg-mute italic">
              The agent is reading the venues and reconciling…
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
                altLabel="venue-quorum oracle (Chainlink shape)"
                summary={cf.costSummary}
                severity={cf.severity}
                divergesFromAgent={cf.divergesFromAgent}
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-fg-dim">
                On Theseus, this entire reasoning bundle is signed and
                verifiable. You don&rsquo;t have to trust the operator;{" "}
                <a
                  href="https://theseus.network/poa/5GjXyA2tF8oP4qN7pK3sL9mZ8r5yA1cB6dV2eW4nT8fH7sB1"
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
          {!isPending && (
            <div className="flex items-baseline gap-3 mt-2 flex-wrap">
              {e.reasonHash && (
                <span className="mono text-[10px] text-fg-mute">
                  {formatHash(e.reasonHash, 6, 6)}
                </span>
              )}
              {hasReasoning && (
                <button
                  className="mono text-[10px] text-coral hover:underline flex items-center gap-1"
                  onClick={() => setReasoningOpen((o) => !o)}
                >
                  {reasoningOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  full reasoning
                </button>
              )}
              {hasInspect && (
                <button
                  className="mono text-[10px] text-fg-dim hover:text-fg flex items-center gap-1"
                  onClick={() => setInspectOpen((o) => !o)}
                >
                  {inspectOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  inspect input/output
                </button>
              )}
            </div>
          )}
          {hasReasoning && reasoningOpen && (
            <div className="mt-2 p-3 rounded-[8px] bg-surface-2 border border-border text-xs leading-relaxed text-fg-dim whitespace-pre-wrap break-words">
              {e.reasoning}
            </div>
          )}
          {hasInspect && inspectOpen && e.inspect && (
            <InspectPanel inspect={e.inspect} />
          )}
        </div>
      </div>
    </li>
  );
}

function InspectPanel({ inspect }: { inspect: AgentInspect }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  return (
    <div className="mt-2 p-3 rounded-[8px] bg-bg border border-border text-xs space-y-3">
      <div className="rounded-[6px] border border-coral/30 bg-coral/5 px-3 py-2 mono text-[10px] leading-relaxed text-fg-dim">
        <span className="text-coral">Proof of Agenthood ·</span> the model that
        ran, the full context it saw, and the reasoning it produced are all
        visible below. On Theseus, this bundle is signed and committed on-chain
        so any third party can verify it.{" "}
        <a
          href="https://theseus.network/poa/5GjXyA2tF8oP4qN7pK3sL9mZ8r5yA1cB6dV2eW4nT8fH7sB1"
          className="text-coral hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          See this agent&apos;s profile ↗
        </a>
      </div>
      <Section label="What the agent saw">
        <ul className="space-y-1">
          {inspect.venues.map((v) => (
            <VenueLine key={v.venue} v={v} />
          ))}
        </ul>
        <div className="mt-1.5 mono text-[10px] text-fg-mute">
          reference price (pre-tamper):{" "}
          <span className="text-fg-dim tnum">
            {inspect.referencePrice > 0
              ? formatUsd(inspect.referencePrice)
              : "–"}
          </span>
        </div>
        {inspect.scenarioHint && (
          <div className="mt-1.5 mono text-[10px] text-fg-mute leading-relaxed">
            scenario hint:{" "}
            <span className="text-fg-dim">{inspect.scenarioHint}</span>
          </div>
        )}
      </Section>

      {inspect.prompt && (
        <Section label={`Model · ${inspect.model ?? "deepseek-chat"} · ${inspect.latencyMs ?? "?"}ms`}>
          <button
            className="mono text-[10px] text-coral hover:underline flex items-center gap-1"
            onClick={() => setShowPrompt((o) => !o)}
          >
            {showPrompt ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            show full prompt ({(inspect.prompt?.system.length ?? 0) +
              (inspect.prompt?.user.length ?? 0)}{" "}
            chars)
          </button>
          {showPrompt && inspect.prompt && (
            <div className="mt-2 space-y-2">
              <PromptBlock label="system" text={inspect.prompt.system} />
              <PromptBlock label="user" text={inspect.prompt.user} />
            </div>
          )}
        </Section>
      )}

      {inspect.rawResponse && (
        <Section label="Raw model response (JSON)">
          <button
            className="mono text-[10px] text-coral hover:underline flex items-center gap-1"
            onClick={() => setShowResponse((o) => !o)}
          >
            {showResponse ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            show raw output
          </button>
          {showResponse && (
            <pre className="mt-2 p-2 rounded bg-surface-2 border border-border mono text-[10px] text-fg-dim whitespace-pre-wrap break-all overflow-x-auto max-h-96 leading-snug">
              {prettyJson(inspect.rawResponse)}
            </pre>
          )}
        </Section>
      )}
    </div>
  );
}

function VenueLine({ v }: { v: VenueReading }) {
  const tag = v.tampered ? " (overridden)" : "";
  const ageClass = v.ageSeconds > 60 ? "text-amber" : "text-fg-mute";
  return (
    <li className="mono text-[10px] flex items-baseline gap-2 flex-wrap">
      <span className="text-fg-mute uppercase tracking-wider w-16">{v.venue}</span>
      {v.ok ? (
        <>
          <span className="text-fg tnum">
            {formatUsd(v.priceUsd)}
            {tag}
          </span>
          <span className="text-fg-mute">
            depth{" "}
            <span className="text-fg-dim tnum">
              {formatUsd(v.depthUsd, { compact: true, decimals: 1 })}
            </span>
          </span>
          <span className={ageClass}>{v.ageSeconds}s ago</span>
        </>
      ) : (
        <span className="text-amber">{v.error ?? "unavailable"}</span>
      )}
    </li>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mono text-[10px] text-fg-mute mb-1">{label}:</div>
      <pre className="p-2 rounded bg-surface-2 border border-border mono text-[10px] text-fg-dim whitespace-pre-wrap break-words leading-snug max-h-64 overflow-y-auto">
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

function SkeletonList() {
  return (
    <ol className="divide-y divide-border">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="py-3 flex items-start gap-3 opacity-40">
          <div className="w-3.5 h-3.5 rounded-full bg-border mt-0.5" />
          <div className="flex-1">
            <div className="h-3 w-32 bg-border rounded" />
            <div className="h-3 w-48 bg-border rounded mt-2" />
          </div>
        </li>
      ))}
    </ol>
  );
}
