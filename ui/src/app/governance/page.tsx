"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { ProposalPanel } from "@/components/governance/ProposalPanel";
import { ReviewButton } from "@/components/governance/ReviewButton";
import { GovernanceScenarioControls } from "@/components/governance/GovernanceScenarioControls";
import { GovernanceTimeline } from "@/components/governance/GovernanceTimeline";
import { GovernanceReviewerJsonLd } from "@/components/JsonLd";
import { CommitmentSurfaceFooter } from "@/components/CommitmentSurfaceFooter";
import {
  GOVERNANCE_PRESETS,
  GovernanceAgentVerdict,
  GovernanceScenarioState,
  applyGovernanceAgentVerdict,
  applyGovernanceOnChainCommit,
  applyGovernanceCommitError,
  applyGovernancePendingAction,
  applyGovernancePreset,
  initialGovernanceScenario,
  setGovernancePending,
  setGovernancePendingReasoning,
} from "@/lib/governance-scenario";
import {
  GovernancePreset,
  readGovernanceUrl,
  replaceUrl,
  writeGovernanceUrl,
} from "@/lib/url-state";

export default function GovernancePage() {
  const [scenario, setScenario] = useState<GovernanceScenarioState>(
    initialGovernanceScenario,
  );
  const [busy, setBusy] = useState(false);
  const [presetKey, setPresetKey] = useState<GovernancePreset | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = readGovernanceUrl(window.location.search);
    if (url.preset) {
      setPresetKey(url.preset);
      setScenario((s) => applyGovernancePreset(s, url.preset!));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    replaceUrl(writeGovernanceUrl({ preset: presetKey ?? undefined }));
  }, [presetKey]);

  const handleReview = useCallback(async () => {
    setBusy(true);
    const optimistic = applyGovernancePendingAction(scenario);
    setScenario(optimistic);

    try {
      const recentVerdicts = scenario.events
        .filter((e) => !e.pending && e.verdict)
        .slice(0, 3)
        .map((e) => ({
          proposalId: e.proposalSnapshot.proposalId,
          decision: e.verdict!.decision,
          reason: e.verdict!.reason,
        }));
      const res = await fetch("/api/agent/governance/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proposal: scenario.proposal,
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
      let finalVerdict: GovernanceAgentVerdict | null = null;

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
                  setGovernancePendingReasoning(s, parsed.text),
                );
              } else if (parsed.type === "final" && parsed.output) {
                finalVerdict = parsed.output as GovernanceAgentVerdict;
                setScenario((s) => applyGovernanceAgentVerdict(s, finalVerdict!));
              } else if (parsed.type === "committed") {
                setScenario((s) =>
                  applyGovernanceOnChainCommit(s, {
                    txHash: parsed.txHash,
                    txUrl: parsed.txUrl,
                    reasonHash: parsed.reasonHash,
                    blobUrl: parsed.blobUrl ?? null,
                  }),
                );
              } else if (parsed.type === "commit_error") {
                setScenario((s) =>
                  applyGovernanceCommitError(s, parsed.error ?? "commit failed"),
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
      const fallback: GovernanceAgentVerdict = {
        decision: "CAUTION",
        reason: "agent unreachable",
        reasoning: `Agent call failed: ${msg}`,
      };
      setScenario((s) => applyGovernanceAgentVerdict(s, fallback));
    } finally {
      setBusy(false);
      setScenario((s) => setGovernancePending(s, false));
    }
  }, [scenario]);

  const handlePreset = useCallback(
    async (key: keyof typeof GOVERNANCE_PRESETS) => {
      setPresetKey(key as GovernancePreset);
      setScenario((s) => applyGovernancePreset(s, key));
    },
    [],
  );

  const handleReset = useCallback(async () => {
    setPresetKey(null);
    setScenario(initialGovernanceScenario());
  }, []);

  return (
    <>
      <GovernanceReviewerJsonLd />
      <TopBar mode="mock" />
      <main className="min-h-screen px-3 sm:px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto pt-6 sm:pt-8">
          <header className="mb-6 sm:mb-8 md:mb-10">
            <div className="eyebrow mb-2">Live demo</div>
            <h1 className="serif text-2xl sm:text-3xl md:text-4xl tracking-tight mb-2">
              Governance Reviewer
            </h1>
            <p className="text-fg-dim text-sm leading-relaxed max-w-2xl">
              Presets cover the Beanstalk flash-loan attack and the
              dust-stake snipe.
            </p>
          </header>

          <div id="governance-scenarios">
            <GovernanceScenarioControls
              agentPending={scenario.pending}
              presetLabel={scenario.presetLabel}
              onPreset={handlePreset}
              onReset={handleReset}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <ProposalPanel
              proposal={scenario.proposal}
              presetLabel={scenario.presetLabel}
            />
            <ReviewButton
              busy={busy}
              pending={scenario.pending}
              onSubmit={handleReview}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GovernanceTimeline entries={scenario.events} />
          </div>
        </div>
        <CommitmentSurfaceFooter contract="governanceReviewer" live />
      </main>
    </>
  );
}
