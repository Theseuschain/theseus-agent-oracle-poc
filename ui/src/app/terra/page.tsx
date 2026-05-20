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
  applyTerraOnChainCommit,
  applyTerraCommitError,
  applyPendingAction,
  applyPreset,
  initialTerraScenario,
  setTerraPendingReasoning,
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
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `http ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let finalVerdict: AgentVerdict | null = null;

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
                  setScenario((s) => setTerraPendingReasoning(s, parsed.text));
                } else if (parsed.type === "final" && parsed.output) {
                  finalVerdict = parsed.output as AgentVerdict;
                  setScenario((s) => applyAgentVerdict(s, finalVerdict!));
                } else if (parsed.type === "committed") {
                  setScenario((s) =>
                    applyTerraOnChainCommit(s, {
                      txHash: parsed.txHash,
                      txUrl: parsed.txUrl,
                      reasonHash: parsed.reasonHash,
                      blobUrl: parsed.blobUrl ?? null,
                    }),
                  );
                } else if (parsed.type === "commit_error") {
                  setScenario((s) =>
                    applyTerraCommitError(
                      s,
                      parsed.error ?? "commit failed",
                    ),
                  );
                } else if (parsed.type === "error") {
                  throw new Error(parsed.error ?? "stream error");
                }
              } catch {
                /* ignore malformed line */
              }
            }
          }
        }

        if (!finalVerdict) throw new Error("stream ended without final verdict");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[terra] decide failed; refusing as safe default", msg);
        setScenario((s) =>
          applyAgentVerdict(s, {
            decision: "REFUSE",
            reason: "agent unreachable",
            reasoning:
              "The agent endpoint did not respond. Refusing is the safer default. Better to revert the action than to mutate a stressed vault on an unverified verdict.",
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
        <div className="mx-auto max-w-[760px] pt-12">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <a
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              ← directory
            </a>
            <a
              href="https://theseus.network/poa/5DkY7e3sN2pQ9bX4hG8wRtL6vK1cM5fT9oP3jW7xZ2aV4hN6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-12 text-[13.5px] leading-[1.7] text-fg-mute">
            The Terra Failsafe Agent is an AI agent that refuses mint and
            redeem when the algorithmic stablecoin vault is stressed. Load a
            preset from the actual Terra/Luna collapse below, then try a mint
            or redeem — watch it refuse where the original contract did not.
          </p>

          <VaultPanel vault={scenario.vault} presetLabel={scenario.presetLabel} />

          <TerraScenarioControls
            agentPending={scenario.pending}
            presetLabel={scenario.presetLabel}
            onPreset={handlePreset}
            onReset={handleReset}
          />

          <MintRedeemForm
            busy={busy}
            pending={scenario.pending}
            onSubmit={handleAction}
          />

          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              recent decisions
            </p>
            <TerraTimeline entries={scenario.events} pending={scenario.pending} />
          </div>
        </div>
      </main>
    </>
  );
}
