"use client";

import { useState } from "react";
import {
  CircleDot,
  ArrowUpRight as ArrowUp,
  ArrowDownRight as ArrowDown,
  ChevronDown,
  ChevronRight,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import {
  FundTimelineEntry,
  navUsd,
  usdcWeight,
} from "@/lib/fund-scenario";
import { useTypewriter } from "@/lib/use-typewriter";

interface Props {
  entries: FundTimelineEntry[];
}

const POA_PROFILE =
  "https://theseus.network/poa/5LkY9d2vH6mR8nQ1bX3cP5tF7eK4aV2sZ8wM5oG1pJqC";

export function FundTimeline({ entries }: Props) {
  return (
    <div className="surface p-4 sm:p-6 lg:col-span-3">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1">Fund decisions</div>
          <div className="serif text-lg">Tick timeline</div>
        </div>
        <span className="text-fg-mute mono text-[10px]">
          {entries.length} tick{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="text-fg-dim text-sm py-8 text-center max-w-md mx-auto leading-relaxed">
          Load a market state above and click{" "}
          <span className="text-fg">Run tick</span>. The agent&apos;s
          decision, reasoning, and the portfolio change will land here.
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

function reasoningOneLiner(reasoning: string): string | undefined {
  const sentences = reasoning
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return undefined;
  const verdictVerbs =
    /\b(Holding|Buying|Selling|Refusing|Allowing|Approving|Cautioning|Rejecting|Pricing)\b/;
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

function actionPalette(a?: "HOLD" | "BUY_WETH" | "SELL_WETH"): {
  icon: typeof CircleDot;
  color: string;
  label: string;
} {
  if (a === "BUY_WETH") {
    return { icon: ArrowUp, color: "text-green", label: "buy weth" };
  }
  if (a === "SELL_WETH") {
    return { icon: ArrowDown, color: "text-amber", label: "sell weth" };
  }
  return { icon: CircleDot, color: "text-fg-mute", label: "hold" };
}

function Row({ entry }: { entry: FundTimelineEntry }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  const isPending = !!entry.pending || !entry.decision;
  const palette = actionPalette(entry.decision?.action);
  const Icon = palette.icon;

  const reasoningText =
    entry.streamingReasoning ?? entry.decision?.reasoning ?? "";
  const typedReasoning = useTypewriter(reasoningText);
  const typewriterCaughtUp =
    !!reasoningText && typedReasoning.length >= reasoningText.length;
  const stillTyping = !!reasoningText && !typewriterCaughtUp;

  const oneLiner =
    !isPending && !stillTyping && entry.decision
      ? reasoningOneLiner(entry.decision.reasoning)
      : undefined;

  const price = entry.marketSnapshot.wethPriceUsd;
  const before = entry.portfolioBefore;
  const after = entry.portfolioAfter;
  const usdcPctBefore = (usdcWeight(before, price) * 100).toFixed(1);
  const usdcPctAfter = after
    ? (usdcWeight(after, price) * 100).toFixed(1)
    : undefined;
  const navBefore = navUsd(before, price);
  const navAfter = after ? navUsd(after, price) : undefined;

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          {isPending ? (
            <Loader2 size={14} className="text-coral animate-spin" />
          ) : (
            <Icon size={14} className={palette.color} />
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
                className={`mono text-[11px] uppercase tracking-wider ${palette.color}`}
              >
                {palette.label}
              </span>
            )}
            {entry.decision && entry.decision.sizeUsd > 0 && (
              <span className="mono text-[11px] text-fg">
                ${entry.decision.sizeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            )}
            {entry.scenarioLabel && (
              <span className="mono text-[10px] text-fg-mute">
                · {entry.scenarioLabel}
              </span>
            )}
          </div>
          {entry.decision && (
            <div className="mono text-sm text-fg-dim mt-0.5 break-words">
              {entry.decision.reason}
            </div>
          )}
          {isPending && !entry.streamingReasoning && (
            <div className="mt-1.5 text-[12px] leading-relaxed text-fg-mute italic">
              The agent is reading market state and its current portfolio…
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
          {after && usdcPctAfter && navAfter !== undefined && (
            <div className="mt-2 rounded-[8px] border border-border bg-surface-2 p-3 text-[11px] leading-relaxed text-fg-dim">
              <span className="mono text-fg-mute">portfolio:</span>{" "}
              <span className="mono">{usdcPctBefore}% USDC</span>
              {usdcPctBefore !== usdcPctAfter && (
                <>
                  {" "}
                  <span className="text-fg-mute">→</span>{" "}
                  <span className="mono text-fg">{usdcPctAfter}% USDC</span>
                </>
              )}
              {" · "}
              <span className="mono text-fg-mute">NAV:</span>{" "}
              <span className="mono">
                ${navBefore.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              {Math.abs(navAfter - navBefore) > 0.01 && (
                <>
                  {" "}
                  <span className="text-fg-mute">→</span>{" "}
                  <span className="mono text-fg">
                    ${navAfter.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </>
              )}
            </div>
          )}
          {entry.decision && (
            <>
              <p className="mt-2 text-[11px] leading-relaxed text-fg-dim">
                On Theseus, this tick&rsquo;s reasoning and the resulting
                portfolio change are signed and verifiable. No human
                approved it;{" "}
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
                {entry.decision.prompt && (
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
                    const el = document.getElementById("fund-scenarios");
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                    } else {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                >
                  try another market <ArrowUpRight size={10} />
                </button>
              </div>
            </>
          )}
          {reasoningOpen && entry.decision && (
            <div className="mt-2 p-3 rounded-[8px] bg-surface-2 border border-border text-xs leading-relaxed text-fg-dim whitespace-pre-wrap break-words">
              {entry.decision.reasoning}
            </div>
          )}
          {inspectOpen && entry.decision?.prompt && (
            <div className="mt-2 grid grid-cols-1 gap-2">
              <details className="p-3 rounded-[8px] bg-surface-2 border border-border">
                <summary className="mono text-[10px] uppercase tracking-wider text-fg-mute cursor-pointer">
                  user message sent to model
                </summary>
                <pre className="mt-2 text-[11px] whitespace-pre-wrap text-fg-dim">
                  {entry.decision.prompt.user}
                </pre>
              </details>
              {entry.decision.rawResponse && (
                <details className="p-3 rounded-[8px] bg-surface-2 border border-border">
                  <summary className="mono text-[10px] uppercase tracking-wider text-fg-mute cursor-pointer">
                    raw model response
                  </summary>
                  <pre className="mt-2 text-[11px] whitespace-pre-wrap text-fg-dim">
                    {entry.decision.rawResponse}
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
