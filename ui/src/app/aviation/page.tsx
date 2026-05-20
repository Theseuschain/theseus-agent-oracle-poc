"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { CertificationPanel } from "@/components/aviation/CertificationPanel";
import { AviationReviewButton } from "@/components/aviation/ReviewButton";
import { AviationScenarioControls } from "@/components/aviation/AviationScenarioControls";
import { AviationTimeline } from "@/components/aviation/AviationTimeline";
import { AviationSafetyReviewerJsonLd } from "@/components/JsonLd";
import {
  AVIATION_PRESETS,
  AviationAgentVerdict,
  AviationScenarioState,
  applyAviationAgentVerdict,
  applyAviationOnChainCommit,
  applyAviationCommitError,
  applyAviationPendingAction,
  applyAviationPreset,
  initialAviationScenario,
  setAviationPending,
  setAviationPendingReasoning,
} from "@/lib/aviation-scenario";
import {
  AviationPreset,
  readAviationUrl,
  replaceUrl,
  writeAviationUrl,
} from "@/lib/url-state";

export default function AviationPage() {
  const [scenario, setScenario] = useState<AviationScenarioState>(
    initialAviationScenario,
  );
  const [busy, setBusy] = useState(false);
  const [presetKey, setPresetKey] = useState<AviationPreset | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = readAviationUrl(window.location.search);
    if (url.preset) {
      setPresetKey(url.preset);
      setScenario((s) => applyAviationPreset(s, url.preset!));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    replaceUrl(writeAviationUrl({ preset: presetKey ?? undefined }));
  }, [presetKey]);

  const handleReview = useCallback(async () => {
    setBusy(true);
    const optimistic = applyAviationPendingAction(scenario);
    setScenario(optimistic);

    try {
      const recentVerdicts = scenario.events
        .filter((e) => !e.pending && e.verdict)
        .slice(0, 3)
        .map((e) => ({
          changeId: e.changeSnapshot.changeId,
          decision: e.verdict!.decision,
          reason: e.verdict!.reason,
        }));
      const res = await fetch("/api/agent/aviation/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          change: scenario.change,
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
      let finalVerdict: AviationAgentVerdict | null = null;

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
                  setAviationPendingReasoning(s, parsed.text),
                );
              } else if (parsed.type === "final" && parsed.output) {
                finalVerdict = parsed.output as AviationAgentVerdict;
                setScenario((s) => applyAviationAgentVerdict(s, finalVerdict!));
              } else if (parsed.type === "committed") {
                setScenario((s) =>
                  applyAviationOnChainCommit(s, {
                    txHash: parsed.txHash,
                    txUrl: parsed.txUrl,
                    reasonHash: parsed.reasonHash,
                    blobUrl: parsed.blobUrl ?? null,
                  }),
                );
              } else if (parsed.type === "commit_error") {
                setScenario((s) =>
                  applyAviationCommitError(s, parsed.error ?? "commit failed"),
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
      const fallback: AviationAgentVerdict = {
        decision: "CAUTION",
        reason: "agent unreachable",
        reasoning: `Agent call failed: ${msg}`,
      };
      setScenario((s) => applyAviationAgentVerdict(s, fallback));
    } finally {
      setBusy(false);
      setScenario((s) => setAviationPending(s, false));
    }
  }, [scenario]);

  const handlePreset = useCallback(
    async (key: keyof typeof AVIATION_PRESETS) => {
      setPresetKey(key as AviationPreset);
      setScenario((s) => applyAviationPreset(s, key));
    },
    [],
  );

  const handleReset = useCallback(async () => {
    setPresetKey(null);
    setScenario(initialAviationScenario());
  }, []);

  return (
    <>
      <AviationSafetyReviewerJsonLd />
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
              href="https://theseus.network/poa/5JhT2nQ8eP6mY4dR1bL9wK3vF7cN5aZ8sH2gM6xV1oCb"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-12 text-[13.5px] leading-[1.7] text-fg-mute">
            The Aviation Safety Reviewer is an AI agent that reads proposed
            aircraft design changes and flags catastrophic failure shapes
            before certification. Pick a preset below — watch it reject the
            MCAS shape that grounded the 737 MAX.
          </p>

          <div id="aviation-scenarios">
            <AviationScenarioControls
              agentPending={scenario.pending}
              presetLabel={scenario.presetLabel}
              onPreset={handlePreset}
              onReset={handleReset}
            />
          </div>

          <div className="mt-10">
            <CertificationPanel
              change={scenario.change}
              presetLabel={scenario.presetLabel}
            />
          </div>

          <div className="mt-8">
            <AviationReviewButton
              busy={busy}
              pending={scenario.pending}
              onSubmit={handleReview}
            />
          </div>

          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              reviewer verdicts
            </p>
            <AviationTimeline entries={scenario.events} />
          </div>
        </div>
      </main>
    </>
  );
}
