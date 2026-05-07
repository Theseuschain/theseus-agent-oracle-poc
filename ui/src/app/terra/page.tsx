"use client";

import { useCallback, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { VaultPanel } from "@/components/terra/VaultPanel";
import { MintRedeemForm } from "@/components/terra/MintRedeemForm";
import { TerraScenarioControls } from "@/components/terra/TerraScenarioControls";
import { TerraTimeline } from "@/components/terra/TerraTimeline";
import {
  ActionKind,
  AgentVerdict,
  PRESETS,
  TerraScenarioState,
  applyAction,
  applyPreset,
  initialTerraScenario,
  ruleAgentVerdict,
  setTerraAgentMode,
  setTerraPending,
} from "@/lib/terra-scenario";

type AgentMode = "rule" | "deepseek";

export default function TerraPage() {
  const [scenario, setScenario] = useState<TerraScenarioState>(initialTerraScenario);
  const [busy, setBusy] = useState(false);

  const handleAction = useCallback(
    async (action: ActionKind, ustdAmount: number) => {
      setBusy(true);

      // Compute rule verdict synchronously (always available as fallback).
      const ruleVerdict = ruleAgentVerdict(scenario.vault, action);

      // Optimistically apply with rule verdict.
      const optimisticState = applyAction(scenario, action, ustdAmount, ruleVerdict);
      setScenario(optimisticState);

      if (scenario.agentMode !== "deepseek") {
        setBusy(false);
        return;
      }

      setScenario((s) => setTerraPending(s, true));

      try {
        const recentVerdicts = scenario.events.slice(0, 3).map((e) => ({
          action: e.action,
          decision: e.verdict.decision,
          reason: e.verdict.reason,
        }));
        const res = await fetch("/api/agent/terra/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            vault: scenario.vault,
            action,
            ustdAmount,
            recentVerdicts,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `http ${res.status}`);
        }
        const verdict = (await res.json()) as AgentVerdict;

        // Replace head event with the LLM verdict and re-apply against the
        // PRE-action vault snapshot (the head event already captured it).
        setScenario((s) => {
          if (s.events.length === 0) return setTerraPending(s, false);
          const head = s.events[0];
          // Roll back the optimistic vault mutation (if any) and re-apply
          // with the new verdict.
          const baseState: TerraScenarioState = {
            ...s,
            vault: head.vaultSnapshot,
            events: s.events.slice(1),
            blockOffset: s.blockOffset - 1,
          };
          return setTerraPending(
            applyAction(baseState, head.action, head.ustdAmount, verdict),
            false,
          );
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[terra] decide failed; keeping rule verdict", msg);
        setScenario((s) => setTerraPending(s, false));
      } finally {
        setBusy(false);
      }
    },
    [scenario],
  );

  const handlePreset = useCallback((key: keyof typeof PRESETS) => {
    setScenario((s) => applyPreset(s, key));
  }, []);

  const handleReset = useCallback(() => {
    setScenario(initialTerraScenario());
  }, []);

  const handleAgentModeChange = useCallback((m: AgentMode) => {
    setScenario((s) => setTerraAgentMode(s, m));
  }, []);

  return (
    <>
      <TopBar mode="mock" />
      <main className="min-h-screen px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto pt-8">
          <Header />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <VaultPanel vault={scenario.vault} presetLabel={scenario.presetLabel} />
            <MintRedeemForm
              busy={busy}
              pending={scenario.pending}
              onSubmit={handleAction}
            />
          </div>

          <TerraScenarioControls
            agentMode={scenario.agentMode}
            agentPending={scenario.pending}
            presetLabel={scenario.presetLabel}
            onAgentModeChange={handleAgentModeChange}
            onPreset={handlePreset}
            onReset={handleReset}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TerraTimeline entries={scenario.events} />
          </div>

          <Footer />
        </div>
      </main>
    </>
  );
}

function Header() {
  return (
    <header className="mb-8 md:mb-10">
      <div className="eyebrow mb-2">Live demo</div>
      <h1 className="serif text-3xl md:text-4xl tracking-tight mb-2">
        Terra Failsafe Agent
      </h1>
      <p className="text-fg-dim text-sm md:text-base max-w-3xl leading-relaxed">
        A Terra-shaped algorithmic stablecoin (USTD/LUND) with one architectural
        change: an agent gates every mint and redeem call. Step through the
        actual May 2022 timeline. The agent refuses when the death-spiral
        pattern fires; the protocol halts gracefully instead of running off the
        cliff. Terra&apos;s contract had no failsafe and lost $60B in four days.
      </p>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 pt-8 border-t border-border text-fg-dim text-xs leading-relaxed">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="eyebrow mb-2">How it works</div>
          The protocol calls the failsafe agent before every mint/redeem.
          The agent reads five vault signals (peg deviation, redemption pressure,
          LUND supply growth, LUND price, reserve coverage) and either ALLOWS
          the action or REFUSES it. Refused actions revert; the user keeps
          their tokens; the system stops moving toward a death spiral.
        </div>
        <div>
          <div className="eyebrow mb-2">What to try</div>
          Step through the presets in order. With the rule-based agent, watch
          the static thresholds fire. Then flip to <span className="text-coral">Agent</span> mode and
          re-run the same actions. The reasoning agent can articulate <em>why</em> a
          given action would extend the cascade, where a rules check just
          returns ALLOW or REFUSE.
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
            Vault state and timeline are simulation. The agent reasoning is
            real (deepseek-chat).
          </div>
        </div>
      </div>
    </footer>
  );
}
