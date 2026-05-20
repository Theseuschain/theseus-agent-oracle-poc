"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { BridgePanel } from "@/components/bridge/BridgePanel";
import { WithdrawForm } from "@/components/bridge/WithdrawForm";
import { BridgeScenarioControls } from "@/components/bridge/BridgeScenarioControls";
import { BridgeTimeline } from "@/components/bridge/BridgeTimeline";
import { BridgeGuardianJsonLd } from "@/components/JsonLd";
import {
  BridgeAgentVerdict,
  BridgeScenarioState,
  BRIDGE_PRESETS,
  applyBridgeAgentVerdict,
  applyBridgeOnChainCommit,
  applyBridgeCommitError,
  applyBridgePendingAction,
  applyBridgePreset,
  initialBridgeScenario,
  setBridgePending,
  setBridgePendingReasoning,
} from "@/lib/bridge-scenario";
import {
  BridgePreset,
  readBridgeUrl,
  replaceUrl,
  writeBridgeUrl,
} from "@/lib/url-state";

export default function BridgePage() {
  const [scenario, setScenario] = useState<BridgeScenarioState>(
    initialBridgeScenario,
  );
  const [busy, setBusy] = useState(false);
  const [presetKey, setPresetKey] = useState<BridgePreset | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = readBridgeUrl(window.location.search);
    if (url.preset) {
      setPresetKey(url.preset);
      setScenario((s) => applyBridgePreset(s, url.preset!));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    replaceUrl(writeBridgeUrl({ preset: presetKey ?? undefined }));
  }, [presetKey]);

  const handleAction = useCallback(
    async (amountUsd: number) => {
      setBusy(true);

      const optimistic = applyBridgePendingAction(scenario, amountUsd);
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
        const res = await fetch("/api/agent/bridge/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            state: scenario.state,
            action: "WITHDRAW",
            amountUsd,
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
        let finalVerdict: BridgeAgentVerdict | null = null;

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
                    setBridgePendingReasoning(s, parsed.text),
                  );
                } else if (parsed.type === "final" && parsed.output) {
                  finalVerdict = parsed.output as BridgeAgentVerdict;
                  setScenario((s) => applyBridgeAgentVerdict(s, finalVerdict!));
                } else if (parsed.type === "committed") {
                  setScenario((s) =>
                    applyBridgeOnChainCommit(s, {
                      txHash: parsed.txHash,
                      txUrl: parsed.txUrl,
                      reasonHash: parsed.reasonHash,
                      blobUrl: parsed.blobUrl ?? null,
                    }),
                  );
                } else if (parsed.type === "commit_error") {
                  setScenario((s) =>
                    applyBridgeCommitError(s, parsed.error ?? "commit failed"),
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

        if (!finalVerdict) throw new Error("stream ended without verdict");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const fallback: BridgeAgentVerdict = {
          decision: "REFUSE",
          reason: "agent unreachable",
          reasoning: `Agent call failed: ${msg}`,
        };
        setScenario((s) => applyBridgeAgentVerdict(s, fallback));
      } finally {
        setBusy(false);
        setScenario((s) => setBridgePending(s, false));
      }
    },
    [scenario],
  );

  const handlePreset = useCallback(
    async (key: keyof typeof BRIDGE_PRESETS) => {
      setPresetKey(key as BridgePreset);
      setScenario((s) => applyBridgePreset(s, key));
    },
    [],
  );

  const handleReset = useCallback(async () => {
    setPresetKey(null);
    setScenario(initialBridgeScenario());
  }, []);

  return (
    <>
      <BridgeGuardianJsonLd />
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
              href="https://theseus.network/poa/5KbR9w3jH8mTcQ2nL5pY7eB1xK4dV6sN8aZ3fW5tH9pM1vXc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-12 text-[13.5px] leading-[1.7] text-fg-mute">
            The Bridge Guardian is an AI agent that gates withdrawals on a
            cross-chain bridge. Load a Ronin, Wormhole, or Nomad attack shape
            below and try to release — watch it refuse where a naive bridge
            would have paid out.
          </p>

          <div id="bridge-scenarios">
            <BridgeScenarioControls
              agentPending={scenario.pending}
              presetLabel={scenario.presetLabel}
              onPreset={handlePreset}
              onReset={handleReset}
            />
          </div>

          <div className="mt-10">
            <BridgePanel
              state={scenario.state}
              presetLabel={scenario.presetLabel}
            />
          </div>

          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <WithdrawForm
              busy={busy}
              pending={scenario.pending}
              onSubmit={handleAction}
            />
          </div>

          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              guardian verdicts
            </p>
            <BridgeTimeline entries={scenario.events} />
          </div>
        </div>
      </main>
    </>
  );
}
