"use client";

import { CertificationChange } from "@/lib/aviation-scenario";

interface Props {
  change: CertificationChange;
  presetLabel: string;
}

export function CertificationPanel({ change: c, presetLabel }: Props) {
  const singleSensorActuator =
    c.canActuateFlightControls && c.primaryTriggerSensorCount === 1;
  const overrideUndocumented = c.canOverridePilotInput && !c.disclosedInFCOM;
  const trainingMismatch =
    c.canActuateFlightControls && c.proposedTrainingClass !== "simulator";

  return (
    <div className="surface p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="eyebrow mb-1">Certification change #{c.changeId}</div>
          <div className="serif text-2xl leading-snug">{c.title}</div>
          <div className="mono text-[11px] text-fg-mute mt-1">
            {c.aircraftModel}
          </div>
        </div>
        <span className="badge badge-stale">{presetLabel}</span>
      </div>

      <div className="mb-4">
        <div className="eyebrow mb-1.5">Summary (manufacturer&apos;s pitch)</div>
        <p className="text-sm leading-relaxed text-fg-dim">{c.summary}</p>
      </div>

      <div className="mb-5 rounded-[8px] border border-border bg-surface-2 p-3">
        <div className="eyebrow mb-1.5">Technical summary (what it actually does)</div>
        <p className="mono text-[12px] leading-relaxed text-fg-dim whitespace-pre-wrap break-words">
          {c.technicalSummary}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
        <Stat
          label="Actuates flight controls"
          value={c.canActuateFlightControls ? "yes" : "no"}
          health={c.canActuateFlightControls ? "crit" : "ok"}
        />
        <Stat
          label="Primary-trigger sensors"
          value={String(c.primaryTriggerSensorCount)}
          sub={c.primaryTriggerSensorCount === 1 ? "single point of failure" : "redundant"}
          health={
            c.canActuateFlightControls && c.primaryTriggerSensorCount === 1
              ? "crit"
              : c.primaryTriggerSensorCount <= 1
                ? "warn"
                : "ok"
          }
        />
        <Stat
          label="Overrides pilot input"
          value={c.canOverridePilotInput ? "yes" : "no"}
          health={c.canOverridePilotInput ? "crit" : "ok"}
        />
        <Stat
          label="Proposed training"
          value={
            c.proposedTrainingClass === "simulator"
              ? "full sim"
              : c.proposedTrainingClass === "ipad"
                ? "iPad differences"
                : "none"
          }
          health={
            trainingMismatch
              ? "crit"
              : c.proposedTrainingClass === "none" && c.canOverridePilotInput
                ? "warn"
                : "ok"
          }
        />
        <Stat
          label="Disclosed in FCOM"
          value={c.disclosedInFCOM ? "yes" : "NO"}
          health={c.disclosedInFCOM ? "ok" : "crit"}
        />
        <Stat
          label="Fleet affected"
          value={c.fleetSize.toLocaleString()}
        />
      </div>

      {(singleSensorActuator || overrideUndocumented) && (
        <div className="mt-4 rounded-[8px] border border-red/40 bg-red/5 p-3 space-y-2">
          {singleSensorActuator && (
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-red mb-1">
                single-sensor flight-control trigger
              </div>
              <p className="text-[12px] text-fg-dim leading-relaxed">
                This change can move flight surfaces based on a reading from
                one sensor with no redundancy. A single failed sensor commands
                a fatal control action. This is the MCAS shape.
              </p>
            </div>
          )}
          {overrideUndocumented && (
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-red mb-1">
                undocumented pilot override
              </div>
              <p className="text-[12px] text-fg-dim leading-relaxed">
                The change can override pilot input but the disengagement
                procedure is not in the Flight Crew Operating Manual. Pilots
                cannot recover from a failure mode they were not told exists.
              </p>
            </div>
          )}
        </div>
      )}

      {c.similarChangesRequiredSimAfterEvents > 0 && (
        <div className="mt-4 rounded-[8px] border border-amber/40 bg-amber/5 p-3">
          <div className="mono text-[10px] uppercase tracking-wider text-amber mb-1">
            {c.similarChangesRequiredSimAfterEvents} similar prior changes ended
            up requiring simulator training after in-service incidents
          </div>
          <p className="text-[12px] text-fg-dim leading-relaxed">
            The manufacturer&apos;s &ldquo;minor change&rdquo; classification
            has lost credibility against the historical pattern.
          </p>
        </div>
      )}
    </div>
  );
}

type Health = "ok" | "warn" | "crit";

function healthColor(h?: Health): string {
  if (h === "crit") return "text-red";
  if (h === "warn") return "text-amber";
  return "text-green";
}

function Stat({
  label,
  value,
  sub,
  health,
}: {
  label: string;
  value: string;
  sub?: string;
  health?: Health;
}) {
  return (
    <div>
      <div className="eyebrow mb-0.5">{label}</div>
      <div className="mono text-sm tnum text-fg">{value}</div>
      {sub && (
        <div
          className={`mono text-[10px] ${healthColor(health) || "text-fg-mute"}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
