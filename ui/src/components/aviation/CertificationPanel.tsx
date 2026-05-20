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
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        certification change #{c.changeId} · {presetLabel}
      </p>
      <div className="mt-2">
        <div className="serif text-2xl leading-snug tracking-tight">
          {c.title}
        </div>
        <p className="mt-1 font-mono text-[11px] text-fg-mute">
          {c.aircraftModel}
        </p>
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-fg-mute">
        {c.summary}
      </p>

      <p className="mt-5 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-fg-mute">
        {c.technicalSummary}
      </p>

      <div className="mt-6 border-t border-border">
        <Row
          label="actuates flight controls"
          value={c.canActuateFlightControls ? "yes" : "no"}
          critical={c.canActuateFlightControls}
        />
        <Row
          label="primary-trigger sensors"
          value={String(c.primaryTriggerSensorCount)}
          sub={
            c.primaryTriggerSensorCount === 0
              ? "no sensor trigger"
              : c.primaryTriggerSensorCount === 1
                ? "single point of failure"
                : "redundant"
          }
          critical={
            c.canActuateFlightControls && c.primaryTriggerSensorCount === 1
          }
        />
        <Row
          label="overrides pilot input"
          value={c.canOverridePilotInput ? "yes" : "no"}
          critical={c.canOverridePilotInput}
        />
        <Row
          label="proposed training"
          value={
            c.proposedTrainingClass === "simulator"
              ? "full sim"
              : c.proposedTrainingClass === "ipad"
                ? "iPad differences"
                : "none"
          }
          critical={trainingMismatch}
        />
        <Row
          label="disclosed in FCOM"
          value={c.disclosedInFCOM ? "yes" : "NO"}
          critical={!c.disclosedInFCOM}
        />
        <Row label="fleet affected" value={c.fleetSize.toLocaleString()} />
      </div>

      {(singleSensorActuator || overrideUndocumented) && (
        <div className="mt-6 space-y-3">
          {singleSensorActuator && (
            <div>
              <p
                className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
                style={{ color: "var(--coral)" }}
              >
                single-sensor flight-control trigger
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-mute">
                This change can move flight surfaces based on a reading from
                one sensor with no redundancy. A single failed sensor commands
                a fatal control action. This is the MCAS shape.
              </p>
            </div>
          )}
          {overrideUndocumented && (
            <div>
              <p
                className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
                style={{ color: "var(--coral)" }}
              >
                undocumented pilot override
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-mute">
                The change can override pilot input but the disengagement
                procedure is not in the Flight Crew Operating Manual. Pilots
                cannot recover from a failure mode they were not told exists.
              </p>
            </div>
          )}
        </div>
      )}

      {c.similarChangesRequiredSimAfterEvents > 0 && (
        <div className="mt-6">
          <p
            className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
            style={{ color: "var(--coral)" }}
          >
            {c.similarChangesRequiredSimAfterEvents} similar prior changes
            ended up requiring simulator training after in-service incidents
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fg-mute">
            The manufacturer&apos;s &ldquo;minor change&rdquo; classification
            has lost credibility against the historical pattern.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  critical,
}: {
  label: string;
  value: string;
  sub?: string;
  critical?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 text-[12.5px]">
      <span className="font-mono text-fg-mute">{label}</span>
      <span className="flex items-baseline gap-3">
        <span
          className="font-mono tnum"
          style={{ color: critical ? "var(--coral)" : "var(--fg)" }}
        >
          {value}
        </span>
        {sub && (
          <span
            className="font-mono text-[10.5px]"
            style={{ color: critical ? "var(--coral)" : "var(--fg-mute)" }}
          >
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}
