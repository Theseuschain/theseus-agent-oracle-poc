"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { AdjudicatorJsonLd } from "@/components/JsonLd";
import { CommitBadge } from "@/components/CommitBadge";
import type { OnChainCommit } from "@/lib/agent-onchain/types";
import { useTypewriter } from "@/lib/use-typewriter";
import { MARKETS, type Citation } from "@/lib/adjudicator-markets";

function daysUntil(deadlineISO: string): number {
  const todayMs = Date.parse(
    new Date().toISOString().slice(0, 10) + "T00:00:00Z",
  );
  const deadlineMs = Date.parse(deadlineISO + "T23:59:59Z");
  return Math.ceil((deadlineMs - todayMs) / 86_400_000);
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface SearchStep {
  query: string;
  citations: Citation[];
}

type FinalOutput = {
  marketId: number;
  winningOption: number;
  confidencePct: number;
  evidenceSummary: string;
  citations: Citation[];
  latencyMs?: number;
  model?: string;
};

type RunState =
  | { kind: "idle" }
  | { kind: "streaming"; reasoning: string }
  | {
      kind: "done";
      output: FinalOutput;
      commit?: OnChainCommit;
      commitError?: string;
    }
  | { kind: "error"; message: string };

const POA_AGENT_ID = "5HsJ4xK2nL8pR3qY7mZ9wB1tF5dH6cV8aN2eW4xT6bP9sM3K";
const ADJUDICATOR_PROFILE = `https://theseus.network/poa/${POA_AGENT_ID}`;

export default function AdjudicatePage() {
  const [selectedId, setSelectedId] = useState<string>(MARKETS[0].id);
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [searchSteps, setSearchSteps] = useState<SearchStep[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("market");
    if (id && MARKETS.some((m) => m.id === id)) setSelectedId(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (selectedId !== MARKETS[0].id) params.set("market", selectedId);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [selectedId]);

  const market = MARKETS.find((m) => m.id === selectedId) ?? MARKETS[0];

  const adjudicate = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRun({ kind: "streaming", reasoning: "" });
    setSearchSteps([]);

    try {
      const res = await fetch("/api/agent/adjudicate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marketId: market.id }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `http ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let final: FinalOutput | null = null;
      let reasoning = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const evt of events) {
          for (const line of evt.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "search_started" && typeof parsed.query === "string") {
                setSearchSteps((prev) => [
                  ...prev,
                  { query: parsed.query, citations: [] },
                ]);
              } else if (parsed.type === "search_results" && Array.isArray(parsed.citations)) {
                setSearchSteps((prev) => {
                  if (prev.length === 0) return prev;
                  const next = prev.slice();
                  const lastIdx = next.length - 1;
                  next[lastIdx] = {
                    ...next[lastIdx],
                    citations: parsed.citations as Citation[],
                  };
                  return next;
                });
              } else if (parsed.type === "text_delta" && typeof parsed.text === "string") {
                reasoning += parsed.text;
                setRun({ kind: "streaming", reasoning });
              } else if (parsed.type === "final" && parsed.output) {
                final = parsed.output as FinalOutput;
                setRun({ kind: "done", output: final });
              } else if (parsed.type === "committed") {
                setRun((prev) =>
                  prev.kind === "done"
                    ? {
                        ...prev,
                        commit: {
                          txHash: parsed.txHash,
                          txUrl: parsed.txUrl,
                          reasonHash: parsed.reasonHash,
                          blobUrl: parsed.blobUrl ?? null,
                        },
                      }
                    : prev,
                );
              } else if (parsed.type === "commit_error") {
                setRun((prev) =>
                  prev.kind === "done"
                    ? { ...prev, commitError: parsed.error ?? "commit failed" }
                    : prev,
                );
              } else if (parsed.type === "error") {
                throw new Error(parsed.error ?? "stream error");
              }
            } catch {
              /* ignore parse errors on non-event lines */
            }
          }
        }
      }

      if (!final) throw new Error("stream ended without verdict");
    } catch (e: unknown) {
      if (ctrl.signal.aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      setRun({ kind: "error", message: msg });
    }
  }, [market.id]);

  useEffect(() => {
    abortRef.current?.abort();
    setRun({ kind: "idle" });
    setSearchSteps([]);
  }, [selectedId]);

  const summaryTarget =
    run.kind === "done" ? run.output.evidenceSummary : "";
  const typedSummary = useTypewriter(summaryTarget);
  const typewriterCaughtUp =
    !!summaryTarget && typedSummary.length >= summaryTarget.length;
  const stillTyping = !!summaryTarget && !typewriterCaughtUp;

  const isStreaming = run.kind === "streaming";
  const isDone = run.kind === "done";
  const daysAway = daysUntil(market.deadlineISO);
  const deadlineFuture = daysAway > 0;
  const trimmedReasoning =
    run.kind === "streaming" ? run.reasoning.trim() : "";
  // The model appends the verdict JSON as the last line; hide it from
  // the streaming view so users don't see a half-rendered payload.
  const displayedReasoning = (() => {
    const lastBrace = trimmedReasoning.lastIndexOf("\n{");
    if (lastBrace > 0 && trimmedReasoning.trimEnd().endsWith("}")) {
      return trimmedReasoning.slice(0, lastBrace).trim();
    }
    return trimmedReasoning;
  })();

  return (
    <>
      <AdjudicatorJsonLd />
      <TopBar mode="mock" />
      <main className="min-h-screen px-3 sm:px-4 md:px-8 pb-12">
        <div className="mx-auto max-w-[640px] pt-12">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <a
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              ← directory
            </a>
            <a
              href={ADJUDICATOR_PROFILE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-12 text-[13.5px] leading-[1.7] text-fg-mute">
            An agent that adjudicates prediction markets by searching the
            web for evidence. Pick a market and watch it gather citations
            and produce a verdict — signed and verifiable.
          </p>

          <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
            markets
          </p>
          <div className="border-t border-border">
            {MARKETS.map((m) => {
              const active = m.id === market.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className="block w-full border-b border-border py-3 text-left transition-colors hover:bg-fg/[0.02]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={`text-[13.5px] leading-snug ${active ? "text-fg" : "text-fg-mute"}`}
                    >
                      {m.question}
                    </span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute shrink-0">
                      {active ? "selected" : m.category}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-10">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                question
              </p>
              <span className="font-mono text-[10.5px] text-fg-mute">
                deadline · {market.deadline}
              </span>
            </div>
            <h2 className="serif mt-2 text-[20px] leading-snug tracking-tight">
              {market.question}
            </h2>

            <ol className="mt-5 space-y-1.5">
              {market.options.map((opt, i) => (
                <li key={i} className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] text-fg-mute w-5 shrink-0">
                    [{i}]
                  </span>
                  <span className="text-[13.5px] text-fg">{opt}</span>
                </li>
              ))}
            </ol>

            <p className="mt-5 text-[13px] leading-relaxed text-fg-mute">
              {market.resolutionCriteria}
            </p>
            <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
              verification source · <span className="text-fg-dim">{market.resolutionSource}</span>
            </p>
          </div>

          {run.kind === "idle" && deadlineFuture && (
            <div className="mt-10 border-t border-border pt-6">
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                not yet resolvable
              </p>
              <p className="mt-3 text-[13.5px] leading-[1.7] text-fg-mute">
                The deadline ({market.deadline}) is{" "}
                <span className="text-fg">
                  {daysAway} {daysAway === 1 ? "day" : "days"}
                </span>{" "}
                away. Any verdict before then would just be a forecast, so
                the agent doesn&rsquo;t run.
              </p>
            </div>
          )}

          {run.kind === "idle" && !deadlineFuture && (
            <button
              onClick={adjudicate}
              className="mt-10 w-full border-b border-border py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-fg transition-colors hover:text-coral"
            >
              adjudicate this market →
            </button>
          )}

          {isStreaming && (
            <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-coral">
              agent searching and reasoning…
            </p>
          )}

          {(isStreaming || isDone || searchSteps.length > 0) && (
            <div className="mt-10">
              <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                search trace
              </p>
              {searchSteps.length > 0 ? (
                <ol className="border-t border-border">
                  {searchSteps.map((step, i) => {
                    const isLast = i === searchSteps.length - 1;
                    const pending =
                      isStreaming && isLast && step.citations.length === 0;
                    return (
                      <li key={i} className="border-b border-border py-3">
                        <p className="text-[13.5px] text-fg leading-snug">
                          {step.query}
                        </p>
                        {pending ? (
                          <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
                            waiting for results…
                          </p>
                        ) : step.citations.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {step.citations.map((c, j) => (
                              <li key={j}>
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[12.5px] leading-snug text-fg-mute hover:text-coral hover:underline"
                                >
                                  <span className="font-mono text-[10.5px] mr-2">
                                    {hostname(c.url)}
                                  </span>
                                  {c.title || c.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
                            no citations returned
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-[13px] leading-relaxed text-fg-mute">
                  The agent will issue web searches for evidence and pull
                  citations from authoritative sources. Each query and the
                  domains it found will appear here.
                </p>
              )}

              {displayedReasoning && (
                <div className="mt-4">
                  <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                    agent reasoning
                  </p>
                  <p className="text-[12.5px] leading-relaxed text-fg-mute whitespace-pre-wrap">
                    {displayedReasoning}
                    {isStreaming && (
                      <span className="ml-0.5 inline-block w-[6px] h-[1em] bg-coral align-text-bottom animate-pulse" />
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {isDone && (
            <div className="mt-10 border-t border-border pt-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                  verdict
                </p>
                <span className="font-mono text-[10.5px] text-fg-mute">
                  {run.output.model} · {run.output.latencyMs ?? "?"}ms
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-fg-mute">
                  [{run.output.winningOption}]
                </span>
                <span
                  className="serif text-[22px] leading-snug tracking-tight"
                  style={{ color: "var(--coral)" }}
                >
                  {market.options[run.output.winningOption] ?? "?"}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-fg-mute ml-auto">
                  {run.output.confidencePct}% confidence
                </span>
              </div>

              <p className="mt-4 text-[13.5px] leading-[1.7] text-fg-mute italic">
                &ldquo;{typedSummary}&rdquo;
                {!typewriterCaughtUp && (
                  <span className="ml-0.5 inline-block w-[6px] h-[1em] bg-coral align-text-bottom animate-pulse" />
                )}
              </p>

              {run.output.citations.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                    sources cited
                  </p>
                  <ul className="space-y-1">
                    {run.output.citations.slice(0, 6).map((c, i) => (
                      <li key={i}>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12.5px] leading-snug text-fg-mute hover:text-coral hover:underline"
                        >
                          <span className="font-mono text-[10.5px] mr-2">
                            {hostname(c.url)}
                          </span>
                          {c.title || c.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <CommitBadge
                commit={run.commit}
                error={run.commitError}
                className="mt-5"
              />

              {market.actualResolution && (
                <div className="mt-5">
                  <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                    polymarket&rsquo;s actual resolution
                  </p>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-fg">
                      [{market.actualResolution.winningOption}]{" "}
                      {market.options[market.actualResolution.winningOption]}
                    </span>
                    <span
                      className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
                      style={{
                        color:
                          market.actualResolution.winningOption ===
                          run.output.winningOption
                            ? "var(--fg)"
                            : "var(--coral)",
                      }}
                    >
                      {market.actualResolution.winningOption ===
                      run.output.winningOption
                        ? "agreed"
                        : "disagreed"}
                    </span>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-fg-mute">
                    {market.actualResolution.note}
                  </p>
                </div>
              )}

              {!stillTyping && (
                <button
                  onClick={adjudicate}
                  className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-mute hover:text-fg hover:underline"
                >
                  re-run →
                </button>
              )}
            </div>
          )}

          {run.kind === "error" && (
            <div className="mt-10 border-t border-border pt-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-coral">
                agent unreachable
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-mute">
                {run.message}
              </p>
              <button
                onClick={adjudicate}
                className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-mute hover:text-fg hover:underline"
              >
                try again →
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
