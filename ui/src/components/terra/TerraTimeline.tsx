"use client";

import { useState } from "react";
import { CircleCheck, CircleX, ChevronDown, ChevronRight, Brain, Cog } from "lucide-react";
import { TimelineEntry } from "@/lib/terra-scenario";

interface Props {
  entries: TimelineEntry[];
}

export function TerraTimeline({ entries }: Props) {
  return (
    <div className="surface p-6 lg:col-span-3">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1">Failsafe verdicts</div>
          <div className="serif text-lg">Action timeline</div>
        </div>
        <span className="text-fg-mute mono text-[10px]">
          {entries.length} action{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="text-fg-dim text-sm py-6 text-center">
          No actions yet. Load a preset and try Mint or Redeem.
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {entries.map((e, i) => (
            <Row key={`${e.block}-${i}`} entry={e} defaultOpen={i === 0} />
          ))}
        </ol>
      )}
    </div>
  );
}

function Row({ entry, defaultOpen }: { entry: TimelineEntry; defaultOpen: boolean }) {
  const [reasoningOpen, setReasoningOpen] = useState(defaultOpen);
  const [inspectOpen, setInspectOpen] = useState(false);

  const allowed = entry.verdict.decision === "ALLOW";
  const isAgent = entry.verdict.agent === "deepseek";

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          {allowed ? (
            <CircleCheck size={14} className="text-green" />
          ) : (
            <CircleX size={14} className="text-red" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="mono text-[11px] text-fg-mute">block {entry.block.toLocaleString()}</span>
            <span
              className={`mono text-[11px] uppercase tracking-wider ${
                allowed ? "text-green" : "text-red"
              }`}
            >
              {allowed ? "allow" : "refuse"}
            </span>
            <span className="mono text-[11px] text-fg">
              {entry.action} {entry.ustdAmount.toLocaleString()} USTD
            </span>
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
            {entry.scenarioLabel && (
              <span className="mono text-[10px] text-fg-mute">· {entry.scenarioLabel}</span>
            )}
          </div>
          <div className="mono text-sm text-fg-dim mt-0.5">{entry.verdict.reason}</div>
          <div className="flex items-baseline gap-3 mt-0.5 flex-wrap">
            <button
              className="mono text-[10px] text-coral hover:underline flex items-center gap-1"
              onClick={() => setReasoningOpen((o) => !o)}
            >
              {reasoningOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              agent reasoning
            </button>
            {(entry.verdict.prompt || entry.vaultSnapshot) && (
              <button
                className="mono text-[10px] text-fg-dim hover:text-fg flex items-center gap-1"
                onClick={() => setInspectOpen((o) => !o)}
              >
                {inspectOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                inspect input/output
              </button>
            )}
          </div>
          {reasoningOpen && (
            <div className="mt-2 p-3 rounded-[8px] bg-surface-2 border border-border text-xs leading-relaxed text-fg-dim whitespace-pre-wrap">
              {entry.verdict.reasoning}
            </div>
          )}
          {inspectOpen && <Inspect entry={entry} />}
        </div>
      </div>
    </li>
  );
}

function Inspect({ entry }: { entry: TimelineEntry }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const v = entry.vaultSnapshot;

  return (
    <div className="mt-2 p-3 rounded-[8px] bg-bg border border-border text-xs space-y-3">
      <div>
        <div className="eyebrow mb-1.5">Vault state at decision</div>
        <ul className="space-y-1 mono text-[10px] text-fg-dim">
          <li>USTD median: <span className="text-fg tnum">${v.ustdMedianUsd.toFixed(3)}</span> ({((1 - v.ustdMedianUsd) * 10000).toFixed(0)}bps below peg)</li>
          <li>Redemption rate: <span className="text-fg tnum">{(v.redemptionRate1h * 100).toFixed(2)}%/h</span></li>
          <li>LUND supply growth 24h: <span className="text-fg tnum">{((v.lundSupplyGrowth24h - 1) * 100).toFixed(1)}%</span></li>
          <li>LUND price 24h: <span className="text-fg tnum">{((v.lundPriceChange24h - 1) * 100).toFixed(1)}%</span></li>
          <li>Reserves: <span className="text-fg tnum">{(v.reserveCoverage * 100).toFixed(1)}%</span> of supply</li>
        </ul>
      </div>

      {entry.verdict.agent === "deepseek" && entry.verdict.prompt && (
        <div>
          <div className="eyebrow mb-1.5">
            Model · {entry.verdict.model ?? "deepseek-chat"} · {entry.verdict.latencyMs ?? "?"}ms
          </div>
          <button
            className="mono text-[10px] text-coral hover:underline flex items-center gap-1"
            onClick={() => setShowPrompt((o) => !o)}
          >
            {showPrompt ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            show full prompt
          </button>
          {showPrompt && (
            <div className="mt-2 space-y-2">
              <PromptBlock label="system" text={entry.verdict.prompt.system} />
              <PromptBlock label="user" text={entry.verdict.prompt.user} />
            </div>
          )}
        </div>
      )}

      {entry.verdict.agent === "deepseek" && entry.verdict.rawResponse && (
        <div>
          <div className="eyebrow mb-1.5">Raw model response</div>
          <button
            className="mono text-[10px] text-coral hover:underline flex items-center gap-1"
            onClick={() => setShowResponse((o) => !o)}
          >
            {showResponse ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            show raw output
          </button>
          {showResponse && (
            <pre className="mt-2 p-2 rounded bg-surface-2 border border-border mono text-[10px] text-fg-dim whitespace-pre-wrap break-all overflow-x-auto max-h-96 leading-snug">
              {pretty(entry.verdict.rawResponse)}
            </pre>
          )}
        </div>
      )}

      {entry.verdict.agent === "rule" && (
        <div className="mono text-[10px] text-fg-mute">
          rule-based agent · no LLM prompt or raw response
        </div>
      )}
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

function pretty(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
