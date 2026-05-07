"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { VaultPanel } from "@/components/terra/VaultPanel";
import { MintRedeemForm } from "@/components/terra/MintRedeemForm";
import { TerraScenarioControls } from "@/components/terra/TerraScenarioControls";
import { TerraTimeline } from "@/components/terra/TerraTimeline";
import { TerraFailsafeJsonLd } from "@/components/JsonLd";
import {
  ActionKind,
  AgentVerdict,
  PRESETS,
  TerraScenarioState,
  applyAgentVerdict,
  applyPendingAction,
  applyPreset,
  initialTerraScenario,
  setTerraPending,
} from "@/lib/terra-scenario";
import {
  readTerraUrl,
  replaceUrl,
  TerraPreset,
  writeTerraUrl,
} from "@/lib/url-state";

export default function TerraPage() {
  const [scenario, setScenario] = useState<TerraScenarioState>(initialTerraScenario);
  const [busy, setBusy] = useState(false);
  // Map the preset key the user last loaded so we can mirror to URL.
  const [presetKey, setPresetKey] = useState<TerraPreset | null>(null);

  // Hydrate from ?preset=… on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = readTerraUrl(window.location.search);
    if (url.preset) {
      setPresetKey(url.preset);
      setScenario((s) => applyPreset(s, url.preset!));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror to URL whenever preset changes.
  useEffect(() => {
    replaceUrl(writeTerraUrl({ preset: presetKey ?? undefined }));
  }, [presetKey]);

  const handleAction = useCallback(
    async (action: ActionKind, ustdAmount: number) => {
      setBusy(true);

      // Push a pending placeholder onto the timeline immediately. The
      // agent fills in the verdict (and we apply the vault mutation if
      // ALLOWED) when the LLM responds.
      const optimistic = applyPendingAction(scenario, action, ustdAmount);
      setScenario(optimistic);

      try {
        const recentVerdicts = scenario.events
          .filter((e) => !e.pending && e.verdict)
          .slice(0, 3)
          .map((e) => ({
            action: e.action,
            decision: e.verdict!.decision,
            reason: e.verdict!.reason,
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
        setScenario((s) => applyAgentVerdict(s, verdict));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[terra] decide failed; refusing as safe default", msg);
        setScenario((s) =>
          applyAgentVerdict(s, {
            decision: "REFUSE",
            reason: "agent unreachable",
            reasoning:
              "The agent endpoint did not respond. Refusing is the safer default — better to revert the action than to mutate a stressed vault on an unverified verdict.",
          }),
        );
      } finally {
        setBusy(false);
      }
    },
    [scenario],
  );

  const handlePreset = useCallback((key: keyof typeof PRESETS) => {
    setPresetKey(key as TerraPreset);
    setScenario((s) => applyPreset(s, key));
  }, []);

  const handleReset = useCallback(() => {
    setPresetKey(null);
    setScenario(initialTerraScenario());
  }, []);

  return (
    <>
      <TerraFailsafeJsonLd />
      <TopBar mode="mock" />
      <main className="min-h-screen px-3 sm:px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto pt-6 sm:pt-8">
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
            agentPending={scenario.pending}
            presetLabel={scenario.presetLabel}
            onPreset={handlePreset}
            onReset={handleReset}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TerraTimeline entries={scenario.events} pending={scenario.pending} />
          </div>

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
          Terra Failsafe Agent
        </h1>
        <a
          href="https://theseus.network/poa/5DkY7e3sN2pQ9bX4hG8wRtL6vK1cM5fT9oP3jW7xZ2aV4hN6"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-[8px] border border-coral/40 bg-coral/5 text-coral hover:bg-coral/10 transition"
        >
          Agent&apos;s PoA profile ↗
        </a>
      </div>
      <p className="text-fg-dim text-sm md:text-base max-w-3xl leading-relaxed">
        An algorithmic stablecoin (USTD/LUND) with one architectural change
        from Terra: an agent gates every mint and redeem. The protocol calls
        the agent <em>before</em> executing; the agent allows or refuses based
        on the vault&apos;s current health. Every verdict carries the full
        context the model saw, signed and committed under{" "}
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
          <span className="text-coral mr-1">1.</span>load a vault state preset
        </li>
        <li>
          <span className="text-coral mr-1">2.</span>try <span className="text-fg">mint</span> or <span className="text-fg">redeem</span>
        </li>
        <li>
          <span className="text-coral mr-1">3.</span>read the verdict, reasoning, and counterfactual
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
          The protocol calls the failsafe agent before every mint/redeem.
          The agent reads five vault signals (peg deviation, redemption pressure,
          LUND supply growth, LUND price, reserve coverage) and either ALLOWS
          the action or REFUSES it. Refused actions revert; the user keeps
          their tokens; the system stops moving toward a death spiral.
        </div>
        <div>
          <div className="eyebrow mb-2">What to try</div>
          Step through the five presets — Healthy, Slight depeg, Peg cracking,
          Bank run, Death spiral — and try the same MINT/REDEEM action at
          each. The agent should ALLOW most actions during Healthy and start
          refusing as the vault deteriorates. The counterfactual badge shows
          what a no-failsafe contract would have done in the same moment.
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
            Vault state is simulation. Agent reasoning is real (deepseek-chat).
          </div>
        </div>
      </div>
    </footer>
  );
}
