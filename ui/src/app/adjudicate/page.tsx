"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { AdjudicatorJsonLd } from "@/components/JsonLd";
import { CommitmentSurfaceFooter } from "@/components/CommitmentSurfaceFooter";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { useTypewriter } from "@/lib/use-typewriter";
import {
  MARKETS,
  type Citation,
  type PredictionMarket,
} from "@/lib/adjudicator-markets";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Gavel,
  ArrowRight,
  Github,
  Clock,
  Search,
  Globe,
} from "lucide-react";

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
  | { kind: "done"; output: FinalOutput }
  | { kind: "error"; message: string };

const POA_AGENT_ID = "5HsJ4xK2nL8pR3qY7mZ9wB1tF5dH6cV8aN2eW4xT6bP9sM3K";
const ADJUDICATOR_PROFILE = `https://theseus.network/poa/${POA_AGENT_ID}`;
const SOURCE_REPO =
  "https://github.com/Theseuschain/the-prediction-market";

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
      setRun({ kind: "done", output: final });
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

  return (
    <>
      <AdjudicatorJsonLd />
      <TopBar mode="mock" />
      <main className="min-h-screen px-3 sm:px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto pt-6 sm:pt-8">
          <Header />

          <div className="surface p-4 sm:p-5 mb-4">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="eyebrow">Markets</div>
              <ShareLinkButton disabled={run.kind === "streaming"} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {MARKETS.map((m) => {
                const active = m.id === market.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`rounded-[10px] border transition px-3 py-3 text-left ${
                      active
                        ? "bg-coral/10 border-coral text-fg"
                        : "bg-surface-2 border-border hover:border-coral text-fg"
                    }`}
                  >
                    <div className="mono text-[10px] uppercase tracking-wider text-fg-mute mb-1">
                      {m.category} · #{m.marketId}
                    </div>
                    <div className="text-sm leading-snug">{m.question}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <CriteriaPanel market={market} />
              <SearchTracePanel
                run={run}
                steps={searchSteps}
                reasoning={run.kind === "streaming" ? run.reasoning : ""}
              />
            </div>

            <div className="lg:col-span-1 space-y-4">
              <VerdictPanel
                run={run}
                market={market}
                typedSummary={typedSummary}
                stillTyping={stillTyping}
                typewriterCaughtUp={typewriterCaughtUp}
                onAdjudicate={adjudicate}
              />
            </div>
          </div>

          <Footer />
        </div>
        <CommitmentSurfaceFooter contract="predictionMarketAdjudicator" />
      </main>
    </>
  );
}

function Header() {
  return (
    <header className="mb-6 sm:mb-8 md:mb-10">
      <div className="eyebrow mb-2">Live demo</div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <h1 className="serif text-2xl sm:text-3xl md:text-4xl tracking-tight">
          Prediction Market Adjudicator
        </h1>
        <a
          href={ADJUDICATOR_PROFILE}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-[8px] border border-coral/40 bg-coral/5 text-coral hover:bg-coral/10 transition"
        >
          Agent&apos;s PoA profile ↗
        </a>
      </div>
      <p className="text-fg-dim text-sm md:text-base max-w-3xl leading-relaxed">
        This is the <code className="font-mono text-fg">resolver_oracle</code>{" "}
        agent from{" "}
        <a
          href={SOURCE_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="text-coral hover:underline"
        >
          Theseuschain/the-prediction-market
        </a>
        . On every run the agent reads the question and criteria, then
        calls <code className="font-mono text-fg">web_search</code> to
        gather evidence fresh; it sees no curated evidence pack. Each
        verdict is signed under{" "}
        <a
          href="https://theseus.network/poa"
          target="_blank"
          rel="noopener noreferrer"
          className="text-coral hover:underline"
        >
          Proof of Agenthood
        </a>
        .
      </p>
      <ol className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[11px] mono uppercase tracking-wider text-fg-mute">
        <li>
          <span className="text-coral mr-1">1.</span>pick a market
        </li>
        <li>
          <span className="text-coral mr-1">2.</span>read the criteria
        </li>
        <li>
          <span className="text-coral mr-1">3.</span>watch the agent search and reason
        </li>
        <li>
          <span className="text-coral mr-1">4.</span>compare against Polymarket
        </li>
      </ol>
    </header>
  );
}

function CriteriaPanel({ market }: { market: PredictionMarket }) {
  return (
    <div className="surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div className="eyebrow">Question</div>
        <span className="mono text-[10px] text-fg-mute uppercase tracking-wider">
          deadline · {market.deadline}
        </span>
      </div>
      <h2 className="serif text-lg leading-snug mb-4">{market.question}</h2>

      <div className="eyebrow mb-2">Options</div>
      <ol className="space-y-1.5 mb-5">
        {market.options.map((opt, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span className="mono text-[11px] text-fg-mute w-5 shrink-0">
              [{i}]
            </span>
            <span className="text-sm">{opt}</span>
          </li>
        ))}
      </ol>

      <div className="eyebrow mb-2">Resolution criteria</div>
      <p className="text-sm leading-relaxed text-fg-dim mb-4">
        {market.resolutionCriteria}
      </p>

      <div className="mono text-[10px] uppercase tracking-wider text-fg-mute">
        verification source · <span className="text-fg-dim">{market.resolutionSource}</span>
      </div>
    </div>
  );
}

function SearchTracePanel({
  run,
  steps,
  reasoning,
}: {
  run: RunState;
  steps: SearchStep[];
  reasoning: string;
}) {
  const isStreaming = run.kind === "streaming";
  const trimmedReasoning = reasoning.trim();
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
    <div className="surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div className="eyebrow">Search trace</div>
        <span className="mono text-[10px] text-fg-mute uppercase tracking-wider">
          live web_search calls
        </span>
      </div>

      {run.kind === "idle" && steps.length === 0 && (
        <p className="text-sm text-fg-dim leading-relaxed">
          When you adjudicate, the agent will issue web searches for evidence
          and pull citations from authoritative sources. Each query and the
          domains it found will appear here.
        </p>
      )}

      {steps.length > 0 && (
        <ol className="space-y-3 mb-3">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const pending = isStreaming && isLast && step.citations.length === 0;
            return (
              <li
                key={i}
                className="rounded-[8px] border border-border bg-surface-2 p-3"
              >
                <div className="flex items-baseline gap-2 mb-2">
                  <Search size={12} className="text-coral shrink-0 translate-y-[2px]" />
                  <span className="text-sm text-fg leading-snug">{step.query}</span>
                </div>
                {pending ? (
                  <div className="mono text-[10px] uppercase tracking-wider text-fg-mute">
                    waiting for results…
                  </div>
                ) : step.citations.length > 0 ? (
                  <ul className="space-y-1.5 pl-5">
                    {step.citations.map((c, j) => (
                      <li key={j} className="flex items-baseline gap-2">
                        <Globe size={10} className="text-fg-mute shrink-0 translate-y-[2px]" />
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12.5px] leading-snug text-fg-dim hover:text-coral hover:underline"
                        >
                          <span className="mono text-[10px] text-fg-mute mr-2">
                            {hostname(c.url)}
                          </span>
                          {c.title || c.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mono text-[10px] uppercase tracking-wider text-fg-mute">
                    no citations returned
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {(isStreaming || run.kind === "done") && displayedReasoning && (
        <div className="mt-3 rounded-[8px] border border-border bg-surface-2 p-3">
          <div className="eyebrow mb-2">Agent reasoning</div>
          <p className="text-[12.5px] leading-relaxed text-fg-dim whitespace-pre-wrap">
            {displayedReasoning}
            {isStreaming && (
              <span className="ml-0.5 inline-block w-[6px] h-[1em] bg-coral align-text-bottom animate-pulse" />
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function VerdictPanel({
  run,
  market,
  typedSummary,
  stillTyping,
  typewriterCaughtUp,
  onAdjudicate,
}: {
  run: RunState;
  market: PredictionMarket;
  typedSummary: string;
  stillTyping: boolean;
  typewriterCaughtUp: boolean;
  onAdjudicate: () => void;
}) {
  const isStreaming = run.kind === "streaming";
  const isDone = run.kind === "done";
  const daysAway = daysUntil(market.deadlineISO);
  const deadlineFuture = daysAway > 0;

  return (
    <div className="surface p-4 sm:p-5 lg:sticky lg:top-4">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div className="eyebrow">Agent verdict</div>
        {isDone && (
          <span className="mono text-[10px] text-fg-mute uppercase tracking-wider">
            {run.output.model} · {run.output.latencyMs ?? "?"}ms
          </span>
        )}
      </div>

      {run.kind === "idle" && deadlineFuture && (
        <div className="rounded-[8px] border border-amber/40 bg-amber/5 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock size={14} className="text-amber" />
            <span className="mono text-[11px] uppercase tracking-wider text-amber">
              not yet resolvable
            </span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-fg-dim mb-2">
            The deadline ({market.deadline}) is{" "}
            <span className="text-fg">
              {daysAway} {daysAway === 1 ? "day" : "days"}
            </span>{" "}
            away. Any verdict before then would just be a forecast, so
            the agent doesn&rsquo;t run.
          </p>
          <p className="mono text-[10px] uppercase tracking-wider text-fg-mute">
            check back after {market.deadline.split(" (")[0]}
          </p>
        </div>
      )}

      {run.kind === "idle" && !deadlineFuture && (
        <button
          onClick={onAdjudicate}
          className="w-full rounded-[8px] bg-coral text-bg hover:bg-[#ff7558] transition px-3 py-3 mono text-[12px] uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <Gavel size={14} />
          Adjudicate this market
        </button>
      )}

      {isStreaming && (
        <div className="rounded-[8px] border border-coral/40 bg-coral/5 px-3 py-3 flex items-center gap-2">
          <Loader2 size={14} className="text-coral animate-spin" />
          <span className="mono text-[11px] text-coral">
            agent searching and reasoning…
          </span>
        </div>
      )}

      {isDone && (
        <WinningOptionPill
          options={market.options}
          winningOption={run.output.winningOption}
          confidencePct={run.output.confidencePct}
        />
      )}

      {isDone && (
        <div className="mt-3">
          <p className="text-[12.5px] leading-relaxed text-fg-dim italic">
            &ldquo;{typedSummary}&rdquo;
            {!typewriterCaughtUp && (
              <span className="ml-0.5 inline-block w-[6px] h-[1em] bg-coral align-text-bottom animate-pulse" />
            )}
          </p>
        </div>
      )}

      {isDone && run.output.citations.length > 0 && (
        <div className="mt-4">
          <div className="eyebrow mb-2">Sources cited</div>
          <ul className="space-y-1.5">
            {run.output.citations.slice(0, 6).map((c, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <Globe size={10} className="text-fg-mute shrink-0 translate-y-[2px]" />
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11.5px] leading-snug text-fg-dim hover:text-coral hover:underline"
                >
                  <span className="mono text-[10px] text-fg-mute mr-1.5">
                    {hostname(c.url)}
                  </span>
                  {c.title || c.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isDone && market.actualResolution && (
        <div className="mt-4 rounded-[8px] border border-border bg-surface-2 p-3">
          <div className="mono text-[10px] uppercase tracking-wider text-fg-mute mb-1.5">
            Polymarket&rsquo;s actual resolution
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="mono text-[11px] text-fg">
              [{market.actualResolution.winningOption}] {market.options[market.actualResolution.winningOption]}
            </span>
            <span
              className={`mono text-[10px] uppercase tracking-wider ${
                market.actualResolution.winningOption === run.output.winningOption
                  ? "text-green"
                  : "text-amber"
              }`}
            >
              {market.actualResolution.winningOption === run.output.winningOption
                ? "agreed"
                : "disagreed"}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-fg-dim">
            {market.actualResolution.note}
          </p>
        </div>
      )}

      {isDone && (
        <p className="mt-4 text-[11px] leading-relaxed text-fg-dim">
          On Theseus, this verdict is signed and verifiable. You don&rsquo;t
          have to trust the operator;{" "}
          <a
            href={ADJUDICATOR_PROFILE}
            target="_blank"
            rel="noopener noreferrer"
            className="text-coral hover:underline"
          >
            check the proof
          </a>
          .
        </p>
      )}

      {isDone && !stillTyping && (
        <button
          onClick={onAdjudicate}
          className="mt-4 w-full rounded-[8px] border border-border bg-surface-2 hover:border-coral hover:text-coral transition px-3 py-2 mono text-[11px] uppercase tracking-wider flex items-center justify-center gap-2"
        >
          Re-run <ArrowRight size={11} />
        </button>
      )}

      {run.kind === "error" && (
        <div className="rounded-[8px] border border-red/40 bg-red/5 p-3">
          <div className="mono text-[11px] text-red mb-1">agent unreachable</div>
          <p className="text-[11px] text-fg-dim leading-relaxed">
            {run.message}
          </p>
          <button
            onClick={onAdjudicate}
            className="mt-3 mono text-[11px] text-coral hover:underline"
          >
            Try again →
          </button>
        </div>
      )}
    </div>
  );
}

function WinningOptionPill({
  options,
  winningOption,
  confidencePct,
}: {
  options: string[];
  winningOption: number;
  confidencePct: number;
}) {
  const opt = options[winningOption] ?? "?";
  const high = confidencePct >= 80;
  const low = confidencePct < 65;
  const palette = high
    ? {
        border: "border-green/50",
        bg: "bg-green/10",
        text: "text-green",
        icon: <CheckCircle2 size={16} className="text-green" />,
      }
    : low
      ? {
          border: "border-amber/50",
          bg: "bg-amber/10",
          text: "text-amber",
          icon: <HelpCircle size={16} className="text-amber" />,
        }
      : {
          border: "border-coral/40",
          bg: "bg-coral/5",
          text: "text-coral",
          icon: <XCircle size={16} className="text-coral" />,
        };

  return (
    <div className={`rounded-[8px] border ${palette.border} ${palette.bg} p-3`}>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2">
          {palette.icon}
          <span className={`mono text-[11px] uppercase tracking-wider ${palette.text}`}>
            winning option
          </span>
        </div>
        <span className={`mono text-[11px] tabular-nums ${palette.text}`}>
          {confidencePct}% confidence
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="mono text-[12px] text-fg-mute">[{winningOption}]</span>
        <span className="text-sm text-fg leading-snug">{opt}</span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 pt-8 border-t border-border text-fg-dim text-xs leading-relaxed">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="eyebrow mb-2">How it works</div>
          The agent is the <code className="font-mono">resolver_oracle.ship</code>{" "}
          program from{" "}
          <a
            href={SOURCE_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="text-coral hover:underline"
          >
            the-prediction-market
          </a>
          . Same input/output (<code className="font-mono">MarketResolutionRequest</code>{" "}
          → <code className="font-mono">ResolutionResult</code>), same system
          prompt. The agent calls{" "}
          <code className="font-mono">web_search</code> live to gather
          evidence on each run.
        </div>
        <div>
          <div className="eyebrow mb-2">What to try</div>
          The four markets cover different shapes: a clear YES (GPT-5
          released), a clear NO (BTC didn&rsquo;t hit $200K), one not
          yet resolvable (Vision Pro 2; the agent waits for the
          deadline), and one that&rsquo;s genuinely contested (iPhone
          Air flop). The agent should call each with appropriate
          confidence.
        </div>
        <div>
          <div className="eyebrow mb-2">Source</div>
          <a
            href={SOURCE_REPO}
            className="text-coral hover:underline mono inline-flex items-center gap-1"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github size={11} /> the-prediction-market
          </a>
          <div className="mt-2">
            <a
              href="https://github.com/Theseuschain/theseus-agent-oracle-poc"
              className="text-coral hover:underline mono"
              target="_blank"
              rel="noopener noreferrer"
            >
              Theseuschain/theseus-agent-oracle-poc
            </a>
          </div>
          <div className="mt-2 mono text-[11px]">
            claude-haiku-4-5 with built-in web_search.
          </div>
        </div>
      </div>
    </footer>
  );
}
