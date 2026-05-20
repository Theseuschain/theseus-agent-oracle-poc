"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { PortfolioPanel } from "@/components/fund/PortfolioPanel";
import { FundTickButton } from "@/components/fund/TickButton";
import { FundScenarioControls } from "@/components/fund/FundScenarioControls";
import { FundTimeline } from "@/components/fund/FundTimeline";
import { SovereignFundLivePanel } from "@/components/fund/SovereignFundLivePanel";
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

const POA_URL =
  "https://theseus.network/poa/5LkY9d2vH6mR8nQ1bX3cP5tF7eK4aV2sZ8wM5oG1pJqC";

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
        <div className="mx-auto max-w-[760px] pt-12">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <a
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              ← directory
            </a>
            <a
              href={POA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-12 text-[13.5px] leading-[1.7] text-fg-mute">
            A sovereign agent that paper-trades a USDC/WETH portfolio against
            a written mandate. Pick a market preset and run a tick — watch
            the agent decide whether to buy, hold, or sell.
          </p>

          <div id="fund-scenarios" className="mb-10">
            <FundScenarioControls
              agentPending={scenario.pending}
              presetLabel={scenario.presetLabel}
              onPreset={handlePreset}
              onReset={handleReset}
            />
          </div>

          <div className="mb-10">
            <PortfolioPanel
              portfolio={scenario.portfolio}
              market={scenario.market}
              presetLabel={scenario.presetLabel}
            />
          </div>

          <div className="mb-10">
            <FundTickButton
              busy={busy}
              pending={scenario.pending}
              onSubmit={handleTick}
            />
          </div>

          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              tick timeline
            </p>
            <FundTimeline entries={scenario.events} />
          </div>

          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              live deployment · base sepolia
            </p>
            <SovereignFundLivePanel />
          </div>
        </div>
      </main>
    </>
  );
}
