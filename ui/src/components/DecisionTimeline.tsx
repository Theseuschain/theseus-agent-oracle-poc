"use client";

import { useState } from "react";
import { TimelineEntry, AgentInspect, VenueReading } from "@/lib/types";
import { formatBlock, formatHash, formatUsd } from "@/lib/format";
import { CircleCheck, CircleX, ChevronDown, ChevronRight, Brain, Cog } from "lucide-react";

interface Props {
  entries: TimelineEntry[];
  loading?: boolean;
}

export function DecisionTimeline({ entries, loading }: Props) {
  return (
    <div className="surface p-6 lg:col-span-3">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1">Recent decisions</div>
          <div className="serif text-lg">Agent timeline</div>
        </div>
        <span className="text-fg-mute mono text-[10px]">
          last {entries.length} runs
        </span>
      </div>

      {loading && entries.length === 0 ? (
        <SkeletonList />
      ) : entries.length === 0 ? (
        <div className="text-fg-dim text-sm py-6 text-center">
          No decisions yet. The agent runs every 10 blocks (~60s).
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {entries.map((e, i) => (
            <TimelineRow
              key={`${e.block}-${i}`}
              entry={e}
              defaultReasoningOpen={i === 0 && e.decision === "REFUSED"}
            />
          ))}
        </ol>
      )}
    </div>
  );
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
  const hasReasoning = !!e.reasoning;
  const hasInspect = !!e.inspect;

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          {e.decision === "REFUSED" ? (
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
            <span
              className={`mono text-[11px] uppercase tracking-wider ${
                e.decision === "REFUSED" ? "text-red" : "text-green"
              }`}
            >
              {e.decision === "REFUSED" ? "refused" : "priced"}
            </span>
            {e.inspect && <AgentTag agent={e.inspect.agent} />}
          </div>
          <div className="mono text-sm text-fg mt-0.5 tnum truncate">
            {e.decision === "REFUSED" ? (
              <span className="text-fg-dim">{e.reason ?? "venue divergence"}</span>
            ) : (
              <>
                {e.priceUsd !== undefined ? formatUsd(e.priceUsd) : "—"}
                {e.maxDeviationBps !== undefined && (
                  <span className="text-fg-mute ml-3">
                    max deviation {e.maxDeviationBps.toFixed(0)}bps
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-baseline gap-3 mt-0.5 flex-wrap">
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
                agent reasoning
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
          {hasReasoning && reasoningOpen && (
            <div className="mt-2 p-3 rounded-[8px] bg-surface-2 border border-border text-xs leading-relaxed text-fg-dim whitespace-pre-wrap">
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

function AgentTag({ agent }: { agent: AgentInspect["agent"] }) {
  const isAgent = agent === "deepseek";
  return (
    <span
      className={`mono text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded ${
        isAgent
          ? "text-coral border border-coral/30 bg-coral/5"
          : "text-fg-mute border border-border bg-surface-2"
      }`}
    >
      {isAgent ? <Brain size={9} /> : <Cog size={9} />}
      {isAgent ? "agent" : "rules"}
    </span>
  );
}

function InspectPanel({ inspect }: { inspect: AgentInspect }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  return (
    <div className="mt-2 p-3 rounded-[8px] bg-bg border border-border text-xs space-y-3">
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
              : "—"}
          </span>
        </div>
        {inspect.scenarioHint && (
          <div className="mt-1.5 mono text-[10px] text-fg-mute leading-relaxed">
            scenario hint:{" "}
            <span className="text-fg-dim">{inspect.scenarioHint}</span>
          </div>
        )}
      </Section>

      {inspect.agent === "deepseek" && (
        <>
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
        </>
      )}
      {inspect.agent === "rule" && (
        <div className="mono text-[10px] text-fg-mute">
          rule-based agent · no LLM prompt or raw response
        </div>
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
