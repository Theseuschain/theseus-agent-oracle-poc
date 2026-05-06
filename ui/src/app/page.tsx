"use client";

import { useCallback, useEffect, useState } from "react";
import { FeedPanel } from "@/components/FeedPanel";
import { VenueCard } from "@/components/VenueCard";
import { PositionPanel } from "@/components/PositionPanel";
import { DecisionTimeline } from "@/components/DecisionTimeline";
import {
  FeedSnapshot,
  VenueReading,
  TimelineEntry,
  UserPosition,
} from "@/lib/types";
import {
  ScenarioState,
  applyPositionAction,
  applyReset,
  applyTamper,
  deriveFeed,
  deriveTimeline,
  deriveVenues,
  initialScenario,
} from "@/lib/mock-scenario";

export default function HomePage() {
  // Mode is detected once on mount via /api/feed. After that, in mock mode
  // the client owns the state — Vercel serverless instances don't share
  // module-level state, so a server-side store wouldn't survive the
  // tamper → poll round trip.
  const [mode, setMode] = useState<"live" | "mock">("mock");
  const [scenario, setScenario] = useState<ScenarioState>(initialScenario);

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

  const feed = mode === "mock" ? deriveFeed(scenario) : liveFeed;
  const venues = mode === "mock" ? deriveVenues(scenario) : liveVenues;
  const timeline = mode === "mock" ? deriveTimeline(scenario) : liveTimeline;
  const position = mode === "mock" ? scenario.position : livePosition;

  const handleTamper = async (venue: VenueReading["venue"], priceUsd: number) => {
    if (mode === "mock") {
      setScenario((s) => applyTamper(s, venue, priceUsd));
      return;
    }
    await fetch("/api/tamper", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ venue, priceUsd, runs: 3 }),
    });
    await refresh();
  };

  const handleReset = async () => {
    if (mode === "mock") {
      setScenario(applyReset);
      return;
    }
    await fetch("/api/reset", { method: "POST" });
    await refresh();
  };

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
    <main className="min-h-screen px-4 md:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        <Header mode={mode} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <FeedPanel feed={feed} loading={!feed} />
          <PositionPanel
            position={position}
            feedRefused={refused}
            onAction={handleAction}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DecisionTimeline entries={timeline} loading={!timeline.length && mode === "live"} />
        </div>

        <Footer />
      </div>
    </main>
  );
}

function Header({ mode }: { mode: "live" | "mock" }) {
  return (
    <header className="mb-8 md:mb-10 flex items-start justify-between gap-4">
      <div>
        <div className="eyebrow mb-2">Live demo</div>
        <h1 className="serif text-3xl md:text-4xl tracking-tight mb-2">
          Theseus Agent Oracle
        </h1>
        <p className="text-fg-dim text-sm md:text-base max-w-2xl">
          Aave V3, unmodified. The price oracle is a SHIP agent reading Coinbase,
          Binance, and a Uniswap V3 pool directly. When the venues disagree, the
          agent refuses to price — and Aave&apos;s price-touching paths revert with it.
        </p>
      </div>
      <div className="hidden sm:block">
        <span className={`badge ${mode === "live" ? "badge-priced" : "badge-stale"}`}>
          {mode === "live" ? "live chain" : "mock data"}
        </span>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 pt-8 border-t border-border text-fg-dim text-xs leading-relaxed">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="eyebrow mb-2">How it works</div>
          The agent runs every 10 blocks (~60s). It calls three tools, applies a
          50bps depth-weighted-median policy, and pushes the result on-chain via{" "}
          <span className="mono text-fg">evm_call</span>. Refusals revert with{" "}
          <span className="mono text-fg">PriceRefused(reasonHash)</span>.
        </div>
        <div>
          <div className="eyebrow mb-2">Try the tamper</div>
          Override one venue with a manipulated price. The next agent run will
          see it, detect the divergence, and refuse. Aave borrows and
          liquidations halt until a clean cycle.
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
            Aave V3 fork: zero modifications. Diff is empty by design.
          </div>
        </div>
      </div>
    </footer>
  );
}
