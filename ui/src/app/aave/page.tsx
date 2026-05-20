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
  setPendingReasoning,
} from "@/lib/mock-scenario";
import {
  AaveScenarioAction,
  readAaveUrl,
  replaceUrl,
  writeAaveUrl,
} from "@/lib/url-state";

export default function HomePage() {
  // Mode is detected once on mount via /api/feed. After that, in mock mode
  // the client owns the state. Vercel serverless instances don't share
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

  // In live mode, poll every 4s. In mock mode, the client owns state, so no poll.
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
      // Network/host failure: keep whatever readings we already had.
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
   * REFUSED with an "agent unreachable" note. Refusing is the safer
   * default per the agent's own system prompt.
   *
   * We deliberately do NOT pass a scenario hint or framing. The agent
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
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `http ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let final: {
          decision: "PRICED" | "REFUSED";
          priceUsd?: number;
          reason: string;
          reasoning: string;
          latencyMs?: number;
          model?: string;
          prompt?: { system: string; user: string };
          rawResponse?: string;
        } | null = null;

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
                if (parsed.type === "reasoning" && typeof parsed.text === "string") {
                  setScenario((s) => setPendingReasoning(s, parsed.text));
                } else if (parsed.type === "final" && parsed.output) {
                  final = parsed.output;
                } else if (parsed.type === "error") {
                  throw new Error(parsed.error ?? "stream error");
                }
              } catch {
                /* ignore malformed line */
              }
            }
          }
        }

        if (!final) throw new Error("stream ended without final verdict");

        const verdict: TimelineEntry = {
          block: headBlock ?? draft.blockOffset,
          decision: final.decision,
          priceUsd: final.priceUsd,
          reason: final.reason,
          reasonHash: hashForReason(final.decision, final.reason ?? ""),
          reasoning: final.reasoning,
          inspect: {
            venues: venuesSnapshot,
            referencePrice: draft.referencePrice,
            prompt: final.prompt,
            rawResponse: final.rawResponse,
            model: final.model,
            latencyMs: final.latencyMs,
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
            "The agent endpoint did not respond. Refusing is the safer default. Better to halt the price feed briefly than to commit a value the agent never confirmed.",
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
  // deliberately do NOT pass any framing or hint. The demo's whole point
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

  // Apply pending URL scenario once venues are loaded. Single-shot; clears
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
        <div className="mx-auto max-w-[760px] pt-12">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <a
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              ← directory
            </a>
            <a
              href="https://theseus.network/poa/5GjXyA2tF8oP4qN7pK3sL9mZ8r5yA1cB6dV2eW4nT8fH7sB1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-12 text-[13.5px] leading-[1.7] text-fg-mute">
            The Theseus Agent Oracle is an AI agent that prices ETH/USD by
            reasoning across three venues instead of taking a median. Try a
            manipulation below — watch it refuse where a quorum oracle would
            have priced.
          </p>

          <div className="mb-6">
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

          <div className="mt-8">
            <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              what the agent sees
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              recent decisions
            </p>
            <DecisionTimeline
              entries={timeline}
              loading={!timeline.length && (mode === "live" || venuesStillLoading)}
            />
          </div>

          <details className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <summary className="cursor-pointer text-[10.5px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg">
              the protocol this oracle prices for ↓
            </summary>
            <p className="mt-3 text-[12px] leading-relaxed text-fg-mute">
              When the agent refuses, the borrow path on this Aave position
              reverts. The user keeps their tokens; the protocol does not open
              a position against a price the agent never confirmed.
            </p>
            <div className="mt-4">
              <PositionPanel
                position={position}
                feedRefused={refused && !venuesStillLoading}
                onAction={handleAction}
              />
            </div>
          </details>
        </div>
      </main>
    </>
  );
}
