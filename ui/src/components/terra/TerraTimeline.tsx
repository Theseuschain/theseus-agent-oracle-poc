"use client";

import { useState } from "react";
import { CircleCheck, CircleX, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { TimelineEntry } from "@/lib/terra-scenario";
import { terraCounterfactual } from "@/lib/counterfactual";
import { CounterfactualBadge } from "../CounterfactualBadge";

interface Props {
  entries: TimelineEntry[];
  pending?: boolean;
}

export function TerraTimeline({ entries }: Props) {
  return (
    <div className="surface p-4 sm:p-6 lg:col-span-3">
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
        <div className="text-fg-dim text-sm py-8 text-center max-w-md mx-auto leading-relaxed">
          Load a vault state above and click <span className="text-fg">Mint</span> or{" "}
          <span className="text-fg">Redeem</span>. The agent&apos;s verdict, the
          one-line reasoning, and what would have happened without it will land
          here.
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {entries.map((e, i) => (
            <Row key={`${e.block}-${i}`} entry={e} defaultOpen={false} />
          ))}
        </ol>
      )}
    </div>
  );
}

function reasoningOneLiner(reasoning: string): string | undefined {
  const parts = reasoning.split(/(?<=[.!?])\s+/);
  if (parts.length === 0) return undefined;
  const first = parts[0].trim();
  if (first.length < 40 && parts.length > 1) {
    return parts.slice(0, 2).join(" ").trim();
  }
  return first;
}

function Row({ entry, defaultOpen }: { entry: TimelineEntry; defaultOpen: boolean }) {
  const [reasoningOpen, setReasoningOpen] = useState(defaultOpen);
  const [inspectOpen, setInspectOpen] = useState(false);

  const isPending = !!entry.pending || !entry.verdict;
  const allowed = !isPending && entry.verdict?.decision === "ALLOW";
  const oneLiner = entry.verdict ? reasoningOneLiner(entry.verdict.reasoning) : undefined;
  const cf = entry.verdict
    ? terraCounterfactual(
        entry.vaultSnapshot,
        entry.action,
        entry.ustdAmount,
        entry.verdict,
      )
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
            <span className="mono text-[11px] text-fg-mute">block {entry.block.toLocaleString()}</span>
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
              {entry.action} {entry.ustdAmount.toLocaleString()} USTD
            </span>
            {entry.scenarioLabel && (
              <span className="mono text-[10px] text-fg-mute">· {entry.scenarioLabel}</span>
            )}
          </div>
          {entry.verdict && (
            <div className="mono text-sm text-fg-dim mt-0.5 break-words">{entry.verdict.reason}</div>
          )}
          {isPending && !entry.streamingReasoning && (
            <div className="mt-1.5 text-[12px] leading-relaxed text-fg-mute italic">
              The agent is reading the vault metrics…
            </div>
          )}
          {isPending && entry.streamingReasoning && (
            <div className="mt-1.5 text-[12px] leading-relaxed text-fg-dim">
              <span className="italic">{entry.streamingReasoning}</span>
              <span className="ml-0.5 inline-block w-[6px] h-[1em] bg-coral align-text-bottom animate-pulse" />
            </div>
          )}
          {!isPending && oneLiner && (
            <div className="mt-1.5 text-[12px] leading-relaxed text-fg-dim italic">
              &ldquo;{oneLiner}&rdquo;
            </div>
          )}
          {cf && (
            <>
              <CounterfactualBadge
                altLabel="naive contract (no failsafe)"
                summary={cf.costSummary}
                severity={cf.severity}
                divergesFromAgent={cf.divergesFromAgent}
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-fg-dim">
                On Theseus, this entire reasoning bundle is signed and
                verifiable. You don&rsquo;t have to trust the operator —{" "}
                <a
                  href="https://theseus.network/poa/5DkY7e3sN2pQ9bX4hG8wRtL6vK1cM5fT9oP3jW7xZ2aV4hN6"
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
                {reasoningOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                full reasoning
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
          )}
          {reasoningOpen && entry.verdict && (
            <div className="mt-2 p-3 rounded-[8px] bg-surface-2 border border-border text-xs leading-relaxed text-fg-dim whitespace-pre-wrap break-words">
              {entry.verdict.reasoning}
            </div>
          )}
          {inspectOpen && entry.verdict && <Inspect entry={entry} />}
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
      <div className="rounded-[6px] border border-coral/30 bg-coral/5 px-3 py-2 mono text-[10px] leading-relaxed text-fg-dim">
        <span className="text-coral">Proof of Agenthood ·</span> the model that
        ran, the full context it saw, and the reasoning it produced are all
        visible below. On Theseus, this bundle is signed and committed on-chain
        so any third party can verify it.{" "}
        <a
          href="https://theseus.network/poa/5DkY7e3sN2pQ9bX4hG8wRtL6vK1cM5fT9oP3jW7xZ2aV4hN6"
          className="text-coral hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          See this agent&apos;s profile ↗
        </a>
      </div>
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

      {entry.verdict?.prompt && (
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

      {entry.verdict?.rawResponse && (
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
