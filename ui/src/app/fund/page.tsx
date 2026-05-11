"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { PortfolioPanel } from "@/components/fund/PortfolioPanel";
import { FundTickButton } from "@/components/fund/TickButton";
import { FundScenarioControls } from "@/components/fund/FundScenarioControls";
import { FundTimeline } from "@/components/fund/FundTimeline";
import { SovereignFundJsonLd } from "@/components/JsonLd";
import {
  FUND_PRESETS,
  FundAgentDecision,
  FundScenarioState,
  applyFundDecision,
  applyFundPendingTick,
  applyFundPreset,
  initialFundScenario,
  setFundPending,
  setFundPendingReasoning,
} from "@/lib/fund-scenario";
import {
  FundPreset,
  readFundUrl,
  replaceUrl,
  writeFundUrl,
} from "@/lib/url-state";

export default function FundPage() {
  const [scenario, setScenario] = useState<FundScenarioState>(
    initialFundScenario,
  );
  const [busy, setBusy] = useState(false);
  const [presetKey, setPresetKey] = useState<FundPreset | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = readFundUrl(window.location.search);
    if (url.preset) {
      setPresetKey(url.preset);
      setScenario((s) => applyFundPreset(s, url.preset!));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    replaceUrl(writeFundUrl({ preset: presetKey ?? undefined }));
  }, [presetKey]);

  const handleTick = useCallback(async () => {
    setBusy(true);
    const optimistic = applyFundPendingTick(scenario);
    setScenario(optimistic);

    try {
      const recentDecisions = scenario.events
        .filter((e) => !e.pending && e.decision)
        .slice(0, 3)
        .map((e) => ({
          action: e.decision!.action,
          sizeUsd: e.decision!.sizeUsd,
          reason: e.decision!.reason,
        }));
      const res = await fetch("/api/agent/fund/tick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          portfolio: scenario.portfolio,
          market: scenario.market,
          recentDecisions,
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `http ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finalDecision: FundAgentDecision | null = null;

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
              if (
                parsed.type === "reasoning" &&
                typeof parsed.text === "string"
              ) {
                setScenario((s) =>
                  setFundPendingReasoning(s, parsed.text),
                );
              } else if (parsed.type === "final" && parsed.output) {
                finalDecision = parsed.output as FundAgentDecision;
              } else if (parsed.type === "error") {
                throw new Error(parsed.error ?? "stream error");
              }
            } catch {
              /* ignore parse errors on non-event lines */
            }
          }
        }
      }

      if (!finalDecision) throw new Error("stream ended without decision");
      setScenario((s) => applyFundDecision(s, finalDecision!));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const fallback: FundAgentDecision = {
        action: "HOLD",
        sizeUsd: 0,
        reason: "agent unreachable",
        reasoning: `Agent call failed: ${msg}`,
      };
      setScenario((s) => applyFundDecision(s, fallback));
    } finally {
      setBusy(false);
      setScenario((s) => setFundPending(s, false));
    }
  }, [scenario]);

  const handlePreset = useCallback(
    async (key: keyof typeof FUND_PRESETS) => {
      setPresetKey(key as FundPreset);
      setScenario((s) => applyFundPreset(s, key));
    },
    [],
  );

  const handleReset = useCallback(async () => {
    setPresetKey(null);
    setScenario(initialFundScenario());
  }, []);

  return (
    <>
      <SovereignFundJsonLd />
      <TopBar mode="mock" />
      <main className="min-h-screen px-3 sm:px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto pt-6 sm:pt-8">
          <header className="mb-6 sm:mb-8 md:mb-10">
            <div className="eyebrow mb-2">Live demo</div>
            <h1 className="serif text-2xl sm:text-3xl md:text-4xl tracking-tight mb-2">
              Sovereign Fund
            </h1>
            <p className="text-fg-dim text-sm md:text-base max-w-3xl leading-relaxed">
              An on-chain fund that owns its own capital (USDC + WETH), runs
              its own decision loop, and rebalances between the two assets
              based on market conditions and its written mandate. No human
              or contract calls it; the agent triggers itself. Each tick:
              read market state, read portfolio, decide HOLD / BUY_WETH /
              SELL_WETH, sign, execute. Pick a market preset below and run
              ticks to see how the mandate translates into action.
            </p>
          </header>

          <div id="fund-scenarios">
            <FundScenarioControls
              agentPending={scenario.pending}
              presetLabel={scenario.presetLabel}
              onPreset={handlePreset}
              onReset={handleReset}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <PortfolioPanel
              portfolio={scenario.portfolio}
              market={scenario.market}
              presetLabel={scenario.presetLabel}
            />
            <FundTickButton
              busy={busy}
              pending={scenario.pending}
              onSubmit={handleTick}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FundTimeline entries={scenario.events} />
          </div>
        </div>
      </main>
    </>
  );
}
