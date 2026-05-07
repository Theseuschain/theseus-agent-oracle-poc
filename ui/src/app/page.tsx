"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FeedPanel } from "@/components/FeedPanel";
import { VenueCard } from "@/components/VenueCard";
import { PositionPanel } from "@/components/PositionPanel";
import { DecisionTimeline } from "@/components/DecisionTimeline";
import { ScenarioControls } from "@/components/ScenarioControls";
import { TopBar } from "@/components/TopBar";
import { AaveOracleJsonLd } from "@/components/JsonLd";
import {
  FeedSnapshot,
  VenueReading,
  TimelineEntry,
  UserPosition,
} from "@/lib/types";
import {
  ScenarioState,
  applyAgentEvent,
  applyDepthCollapse,
  applyHalt,
  applyLiveReadings,
  applyPositionAction,
  applyProportionalMove,
  applyPumpAll,
  applyReset,
  applyTamper,
  applyUnhalt,
  deriveFeed,
  deriveTimeline,
  deriveVenues,
  hashForReason,
  initialScenario,
} from "@/lib/mock-scenario";
import {
  AaveScenarioAction,
  readAaveUrl,
  replaceUrl,
  writeAaveUrl,
} from "@/lib/url-state";

export default function HomePage() {
  // Mode is detected once on mount via /api/feed. After that, in mock mode
  // the client owns the state — Vercel serverless instances don't share
  // module-level state, so a server-side store wouldn't survive the
  // tamper → poll round trip.
  const [mode, setMode] = useState<"live" | "mock">("mock");
  const [scenario, setScenario] = useState<ScenarioState>(initialScenario);
  // Last scenario action the user (or URL) triggered. Mirrors to ?scenario=
  // so the URL reproduces the moment.
  const [lastScenario, setLastScenario] = useState<AaveScenarioAction | null>(
    null,
  );
  // URL-supplied scenario action waiting for liveBase to populate so the
  // override prices have something to anchor to. Cleared once applied.
  const pendingUrlScenarioRef = useRef<AaveScenarioAction | null>(null);

  // Live-mode state. Only populated when the chain is reachable.
  const [liveFeed, setLiveFeed] = useState<FeedSnapshot | null>(null);
  const [liveVenues, setLiveVenues] = useState<VenueReading[]>([]);
  const [liveTimeline, setLiveTimeline] = useState<TimelineEntry[]>([]);
  const [livePosition, setLivePosition] = useState<UserPosition | null>(null);

  // Detect mode + (in live mode) refresh.
  const refresh = useCallback(async () => {
    try {
      const [feedRes, timelineRes, positionRes] = await Promise.all([
        fetch("/api/feed", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/timeline", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/position", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setMode(feedRes.mode);
      if (feedRes.mode === "live") {
        setLiveFeed(feedRes.feed);
        setLiveVenues(feedRes.venues);
        setLiveTimeline(timelineRes.entries);
        setLivePosition(positionRes.position);
      }
    } catch {
      setMode("mock");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // In live mode, poll every 4s. In mock mode, the client owns state — no poll.
  useEffect(() => {
    if (mode !== "live") return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [mode, refresh]);

  // Real venue prices come from /api/venues regardless of mode (mock or live).
  // The agent in production reads the same APIs; the UI here gives an honest
  // preview. Tamper / halt overlays sit on top of these readings.
  const refreshVenues = useCallback(async () => {
    try {
      const res = await fetch("/api/venues", { cache: "no-store" }).then((r) => r.json());
      if (Array.isArray(res.venues)) {
        setScenario((s) => applyLiveReadings(s, res.venues));
      }
    } catch (e) {
      // Network/host failure — keep whatever readings we already had.
      console.warn("[venues] poll failed", e);
    }
  }, []);

  useEffect(() => {
    refreshVenues();
    const id = setInterval(refreshVenues, 15_000);
    return () => clearInterval(id);
  }, [refreshVenues]);

  const venuesStillLoading =
    mode === "mock" &&
    scenario.liveBase.every((v) => !v.ok && v.error === "loading…");

  // ── URL state ─────────────────────────────────────────────────────────────
  // Hydrate scenario from ?scenario=… on first paint. The action runs as
  // soon as venues are ready (otherwise overrides would write through to
  // a referencePrice of 0).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = readAaveUrl(window.location.search);
    if (url.scenario) pendingUrlScenarioRef.current = url.scenario;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const feed = mode === "mock" ? deriveFeed(scenario) : liveFeed;
  const venues = mode === "mock" ? deriveVenues(scenario) : liveVenues;
  const timeline = mode === "mock" ? deriveTimeline(scenario) : liveTimeline;
  const position = mode === "mock" ? scenario.position : livePosition;

  /**
   * Every user action pushes a pending placeholder onto the timeline and
   * issues a real LLM call. When the response lands we replace the head
   * placeholder with the agent's verdict. On failure we mark the head
   * REFUSED with an "agent unreachable" note — refusing is the safer
   * default per the agent's own system prompt.
   *
   * We deliberately do NOT pass a scenario hint or framing — the agent
   * has to reason from the venue readings alone.
   */
  const runWithAgent = useCallback(
    async (compute: (s: ScenarioState) => ScenarioState) => {
      const draft = compute(scenario);
      setScenario(draft);

      const venuesSnapshot = deriveVenues(draft);
      const headBlock = draft.events[0]?.block;
      try {
        // Skip past the new pending head when constructing recent context.
        const recent = draft.events.slice(1, 4);
        const res = await fetch("/api/agent/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            venues: venuesSnapshot,
            referencePrice: draft.referencePrice,
            recentDecisions: recent,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `http ${res.status}`);
        }
        const decision = await res.json();

        const verdict: TimelineEntry = {
          block: headBlock ?? draft.blockOffset,
          decision: decision.decision,
          priceUsd: decision.priceUsd,
          reason: decision.reason,
          reasonHash: hashForReason(decision.decision, decision.reason ?? ""),
          reasoning: decision.reasoning,
          inspect: {
            venues: venuesSnapshot,
            referencePrice: draft.referencePrice,
            prompt: decision.prompt,
            rawResponse: decision.rawResponse,
            model: decision.model,
            latencyMs: decision.latencyMs,
          },
        };
        setScenario((s) => applyAgentEvent(s, verdict));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[agent] decide failed; refusing as safe default", msg);
        const fallback: TimelineEntry = {
          block: headBlock ?? draft.blockOffset,
          decision: "REFUSED",
          reason: "agent unreachable",
          reasonHash: hashForReason("REFUSED", "agent unreachable"),
          reasoning:
            "The agent endpoint did not respond. Refusing is the safer default — better to halt the price feed briefly than to commit a value the agent never confirmed.",
          inspect: {
            venues: venuesSnapshot,
            referencePrice: draft.referencePrice,
          },
        };
        setScenario((s) => applyAgentEvent(s, fallback));
      }
    },
    [scenario],
  );

  const handleTamper = async (venue: VenueReading["venue"], priceUsd: number) => {
    if (mode === "live") {
      await fetch("/api/tamper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venue, priceUsd, runs: 3 }),
      });
      await refresh();
      return;
    }
    setLastScenario({ kind: "tamper", venue, value: priceUsd });
    await runWithAgent((s) => applyTamper(s, venue, priceUsd));
  };

  const handleReset = async () => {
    if (mode === "live") {
      await fetch("/api/reset", { method: "POST" });
      await refresh();
      return;
    }
    setLastScenario(null);
    await runWithAgent(applyReset);
  };

  const handlePumpAll = async (priceUsd: number) => {
    if (mode === "live") {
      for (const v of ["coinbase", "binance", "uniswap"] as const) {
        await fetch("/api/tamper", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ venue: v, priceUsd, runs: 3 }),
        });
      }
      await refresh();
      return;
    }
    setLastScenario({ kind: "pump-all", value: priceUsd });
    await runWithAgent((s) => applyPumpAll(s, priceUsd));
  };

  const handleHaltToggle = async (venue: VenueReading["venue"]) => {
    if (mode === "live") {
      console.warn("[halt] live mode not yet wired");
      return;
    }
    setLastScenario({ kind: "halt", venue });
    await runWithAgent((s) =>
      s.halted[venue] ? applyUnhalt(s, venue) : applyHalt(s, venue),
    );
  };

  // Black-swan scenario presets. Each one mutates the venues data in a
  // specific way and lets the agent reason from the raw signals. We
  // deliberately do NOT pass any framing or hint — the demo's whole point
  // is that the agent has to identify the failure mode from inputs alone.
  const handleBlackSwan = async (kind: "depth-collapse" | "subtle-pump" | "flash-crash") => {
    setLastScenario({ kind });
    if (kind === "depth-collapse") {
      await runWithAgent((s) => applyDepthCollapse(s, 0.05));
    } else if (kind === "subtle-pump") {
      await runWithAgent((s) => applyProportionalMove(s, 1.49));
    } else if (kind === "flash-crash") {
      await runWithAgent((s) => applyProportionalMove(s, 0.7));
    }
  };

  // Mirror the last scenario action to the URL. No-op in live mode (URL
  // is for shareable mock states).
  useEffect(() => {
    if (mode !== "mock") return;
    replaceUrl(writeAaveUrl({ scenario: lastScenario ?? undefined }));
  }, [lastScenario, mode]);

  // Apply pending URL scenario once venues are loaded. Single-shot — clears
  // the ref after apply.
  useEffect(() => {
    if (mode !== "mock") return;
    if (venuesStillLoading) return;
    const pending = pendingUrlScenarioRef.current;
    if (!pending) return;
    pendingUrlScenarioRef.current = null;
    if (pending.kind === "pump-all") handlePumpAll(pending.value);
    else if (pending.kind === "halt") handleHaltToggle(pending.venue);
    else if (pending.kind === "tamper") handleTamper(pending.venue, pending.value);
    else if (pending.kind === "depth-collapse") handleBlackSwan("depth-collapse");
    else if (pending.kind === "subtle-pump") handleBlackSwan("subtle-pump");
    else if (pending.kind === "flash-crash") handleBlackSwan("flash-crash");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venuesStillLoading, mode]);

  const handleAction = async (
    action: "deposit" | "borrow" | "repay" | "withdraw",
    amountStr: string,
  ): Promise<{ ok: boolean; revertReason?: string }> => {
    const amount = amountStr === "max" ? Number.MAX_SAFE_INTEGER : Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, revertReason: "invalid amount" };
    }

    if (mode === "mock" && feed?.decision === "REFUSED" && (action === "borrow" || action === "withdraw")) {
      return { ok: false, revertReason: `PriceRefused(${feed.reasonHash.slice(0, 12)}…)` };
    }

    if (mode === "mock") {
      setScenario((s) => applyPositionAction(s, action, amount));
      return { ok: true };
    }

    const res = await fetch("/api/position", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, amount }),
    });
    const json = await res.json();
    await refresh();
    return json;
  };

  const refused = feed?.decision === "REFUSED";

  return (
    <>
      <AaveOracleJsonLd />
      <TopBar mode={mode} />
      <main className="min-h-screen px-3 sm:px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto pt-6 sm:pt-8">
        <Header />

        <div className="mb-4">
          <FeedPanel feed={feed} loading={!feed || venuesStillLoading} />
        </div>

        {mode === "mock" && (
          <ScenarioControls
            haltedVenues={
              (Object.keys(scenario.halted) as VenueReading["venue"][]).filter(
                (v) => scenario.halted[v],
              )
            }
            anyOverride={
              Object.values(scenario.overrides).some((v) => v !== undefined) ||
              Object.values(scenario.depthMultipliers).some((v) => v !== undefined)
            }
            agentPending={scenario.pending}
            onPumpAll={handlePumpAll}
            onHaltToggle={handleHaltToggle}
            onResetAll={handleReset}
            onBlackSwan={handleBlackSwan}
          />
        )}

        <div className="mb-2">
          <div className="eyebrow mb-2">Real venue readings</div>
          <p className="text-xs text-fg-mute mb-3">
            What the agent sees right now, fetched from the public APIs of each
            venue. Use the per-card Tamper button to override one venue while
            leaving the others untouched.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["coinbase", "binance", "uniswap"] as const).map((v) => {
              const reading = venues.find((r) => r.venue === v) ?? null;
              return (
                <VenueCard
                  key={v}
                  reading={reading ?? { venue: v, priceUsd: 0, depthUsd: 0, ok: false, ageSeconds: 0 }}
                  onTamper={(price) => handleTamper(v, price)}
                  onReset={handleReset}
                  loading={!reading}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-4 mb-4">
          <div className="eyebrow mb-2">Agent decisions</div>
          <DecisionTimeline
            entries={timeline}
            loading={!timeline.length && (mode === "live" || venuesStillLoading)}
          />
        </div>

        <details className="mb-4">
          <summary className="cursor-pointer mono text-[11px] uppercase tracking-wider text-fg-mute hover:text-fg list-none flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 border-r border-b border-current rotate-[-45deg] details-arrow"></span>
            Aave position (connect a wallet)
          </summary>
          <div className="mt-3">
            <PositionPanel
              position={position}
              feedRefused={refused && !venuesStillLoading}
              onAction={handleAction}
            />
          </div>
        </details>

        <Footer />
        </div>
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
          Theseus Agent Oracle
        </h1>
        <a
          href="https://theseus.network/poa/5GjXyA2tF8oP4qN7pK3sL9mZ8r5yA1cB6dV2eW4nT8fH7sB1"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-[8px] border border-coral/40 bg-coral/5 text-coral hover:bg-coral/10 transition"
        >
          Agent&apos;s PoA profile ↗
        </a>
      </div>
      <p className="text-fg-dim text-sm md:text-base max-w-3xl leading-relaxed">
        Real ETH/USD prices from Coinbase, Binance, and Uniswap V3. An agent
        reads all three, decides whether to price or refuse, and writes the
        result to a Solidity contract that Aave V3 reads through. Try a
        manipulation in the panel below; the agent&apos;s verdict and reasoning
        show up in the timeline. Every decision the agent makes carries the
        full context the model saw, signed and committed under{" "}
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
          <span className="text-coral mr-1">1.</span>pick a manipulation
        </li>
        <li>
          <span className="text-coral mr-1">2.</span>watch the agent reason and decide
        </li>
        <li>
          <span className="text-coral mr-1">3.</span>compare against the venue-quorum oracle
        </li>
      </ol>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 pt-8 border-t border-border text-fg-dim text-xs leading-relaxed">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="eyebrow mb-2">How it works</div>
          The agent runs every 10 blocks (~60s). It reads the three venues,
          reconciles them, and writes the result to{" "}
          <span className="mono text-fg">AgentPriceFeed.sol</span>. Refusals
          revert with <span className="mono text-fg">PriceRefused(reasonHash)</span>,
          which halts every Aave path that touches the price.
        </div>
        <div>
          <div className="eyebrow mb-2">What to try</div>
          Pump every venue to the same fake number. Halt one. Tamper a single
          one from its card. Each scenario should make the agent refuse for a
          different reason. The flash-crash preset tests the opposite: a real
          market move the agent should accept.
        </div>
        <div>
          <div className="eyebrow mb-2">Source</div>
          <a
            href="https://github.com/Theseuschain/theseus-agent-oracle-poc"
            className="text-coral hover:underline mono"
            target="_blank"
            rel="noopener noreferrer"
          >
            Theseuschain/theseus-agent-oracle-poc
          </a>
          <div className="mt-2 mono text-[11px]">
            Aave V3 fork: zero modifications. The diff is empty by design.
          </div>
        </div>
      </div>
    </footer>
  );
}
