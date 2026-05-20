"use client";

import { useState } from "react";
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
  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-fg-mute">
        Load a market above and run a tick. The agent&apos;s decision,
        reasoning, and portfolio change will appear here.
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

function actionLabel(a?: "HOLD" | "BUY_WETH" | "SELL_WETH"): string {
  if (a === "BUY_WETH") return "buy weth";
  if (a === "SELL_WETH") return "sell weth";
  return "hold";
}

function Row({ entry }: { entry: FundTimelineEntry }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  const isPending = !!entry.pending || !entry.decision;
  const action = entry.decision?.action;
  const label = actionLabel(action);
  const isRefused = false;
  const isAction = action === "BUY_WETH" || action === "SELL_WETH";

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

  const hasReasoning = !isPending && !!entry.decision?.reasoning;
  const hasInspect = !isPending && !!entry.decision?.prompt;

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
            className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em]"
            style={{
              color: isAction ? "var(--green)" : "var(--fg)",
            }}
          >
            {label}
          </span>
        )}
        {entry.decision && entry.decision.sizeUsd > 0 && (
          <span className="font-mono tnum text-fg">
            ${entry.decision.sizeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        )}
        {entry.scenarioLabel && (
          <span className="font-mono text-[10.5px] text-fg-mute">
            · {entry.scenarioLabel}
          </span>
        )}
      </div>

      {entry.decision && (
        <p className="mt-1 font-mono text-[12px] text-fg-mute break-words">
          {entry.decision.reason}
        </p>
      )}

      {isPending && !entry.streamingReasoning && (
        <p className="mt-1 text-[12px] italic text-fg-mute">
          The agent is reading market state and its current portfolio…
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

      {after && usdcPctAfter && navAfter !== undefined && (
        <p className="mt-2 font-mono text-[11px] text-fg-mute">
          portfolio: <span className="tnum">{usdcPctBefore}% USDC</span>
          {usdcPctBefore !== usdcPctAfter && (
            <>
              {" → "}
              <span className="tnum text-fg">{usdcPctAfter}% USDC</span>
            </>
          )}
          {" · NAV "}
          <span className="tnum">
            ${navBefore.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          {Math.abs(navAfter - navBefore) > 0.01 && (
            <>
              {" → "}
              <span className="tnum text-fg">
                ${navAfter.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </>
          )}
        </p>
      )}

      {!isPending && entry.decision && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[10.5px] text-fg-mute">
          <a
            href={POA_PROFILE}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-fg hover:underline"
          >
            check the proof ↗
          </a>
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
          {!isRefused && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("fund-scenarios");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className="ml-auto transition-colors hover:text-fg hover:underline"
            >
              try another market ↑
            </button>
          )}
        </div>
      )}

      {reasoningOpen && entry.decision && (
        <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-mute">
          {entry.decision.reasoning}
        </p>
      )}

      {inspectOpen && entry.decision?.prompt && (
        <div className="mt-3 border-l-2 border-border pl-4 font-mono text-[10.5px] text-fg-mute">
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
            user message sent to model
          </p>
          <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] leading-snug">
            {entry.decision.prompt.user}
          </pre>
          {entry.decision.rawResponse && (
            <>
              <p className="mt-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                raw model response
              </p>
              <pre className="mt-2 max-h-96 overflow-x-auto whitespace-pre-wrap break-all text-[10px] leading-snug">
                {entry.decision.rawResponse}
              </pre>
            </>
          )}
        </div>
      )}
    </li>
  );
}
