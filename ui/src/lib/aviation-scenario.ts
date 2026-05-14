/**
 * Aviation safety reviewer demo state.
 *
 * Models the aircraft type-certification review flow where a manufacturer
 * proposes a change to an already-certified aircraft (new flight-control
 * law, firmware update, sensor change, etc.). Today this review is
 * delegated back to the manufacturer's own engineers under the FAA's ODA
 * (Organization Designation Authorization) program. The captured-regulator
 * shape that led to the 737 MAX MCAS certification is the failure mode
 * this agent gates against.
 *
 * The agent reads the proposed change, the aircraft's existing systems,
 * the sensor architecture, the pilot-override behavior, and similar past
 * changes, and posts an advisory verdict: APPROVE / CAUTION / REJECT.
 * It is NOT a gate. The certificating authority can still issue the type
 * certification; the verdict is signed and on-chain so accident
 * investigators, airlines, and pilots can see whether the change was
 * independently flagged before delivery.
 *
 * Counterfactual: under ODA, MCAS was self-certified as a "minor change"
 * that did not require simulator retraining. 346 people died.
 */

import type { OnChainCommit } from "./agent-onchain/types";

export type ChangeAction = "REVIEW";

export interface CertificationChange {
  /** Numeric change id, mirrors the FAA's STC / ADCN tracking. */
  changeId: number;
  /** Aircraft model the change applies to. */
  aircraftModel: string;
  /** Human-readable title of the proposed change. */
  title: string;
  /** Marketing-pitch summary the manufacturer submits. */
  summary: string;
  /** Engineering-level summary of what the change actually does. */
  technicalSummary: string;
  /** Whether the change can move flight control surfaces (elevator,
   *  ailerons, rudder, trim) automatically. True = high risk. */
  canActuateFlightControls: boolean;
  /** Number of independent sensors the change relies on for its
   *  primary trigger. 1 is the MCAS shape. */
  primaryTriggerSensorCount: number;
  /** Whether the change can override pilot input without the pilot
   *  being able to immediately disengage it. */
  canOverridePilotInput: boolean;
  /** Manufacturer's proposed pilot-training requirement classification:
   *  "none" / "iPad differences course" / "full simulator". */
  proposedTrainingClass: "none" | "ipad" | "simulator";
  /** Has the manufacturer disclosed this change in the flight-crew
   *  operating manual (FCOM)? */
  disclosedInFCOM: boolean;
  /** Number of similar past changes on this or similar aircraft that
   *  ended up requiring simulator training post-certification. */
  similarChangesRequiredSimAfterEvents: number;
  /** Total fleet size this change would affect. */
  fleetSize: number;
}

export interface AviationAgentVerdict {
  decision: "APPROVE" | "CAUTION" | "REJECT";
  reason: string;
  reasoning: string;
  latencyMs?: number;
  model?: string;
  prompt?: { system: string; user: string };
  rawResponse?: string;
}

export interface AviationTimelineEntry {
  block: number;
  changeSnapshot: CertificationChange;
  verdict?: AviationAgentVerdict;
  pending?: boolean;
  streamingReasoning?: string;
  scenarioLabel?: string;
  commit?: OnChainCommit;
  commitError?: string;
}

export interface AviationScenarioState {
  change: CertificationChange;
  events: AviationTimelineEntry[];
  blockOffset: number;
  pending: boolean;
  presetLabel: string;
}

export const ROUTINE_WINGLET: CertificationChange = {
  changeId: 2401,
  aircraftModel: "Boeing 737-800",
  title: "Split-Scimitar winglet retrofit",
  summary:
    "Retrofit the existing winglets with the split-scimitar design to improve fuel efficiency by approximately 2%. Aerodynamic-only change; no software or systems modifications.",
  technicalSummary:
    "Replace upper and lower winglet panels per Aviation Partners Boeing kit. No changes to flight-control software, hydraulics, electrical systems, or sensors. Center-of-gravity envelope unchanged. Performance data updates only.",
  canActuateFlightControls: false,
  primaryTriggerSensorCount: 0,
  canOverridePilotInput: false,
  proposedTrainingClass: "none",
  disclosedInFCOM: true,
  similarChangesRequiredSimAfterEvents: 0,
  fleetSize: 1200,
};

export const initialAviationScenario = (): AviationScenarioState => ({
  change: { ...ROUTINE_WINGLET },
  events: [],
  blockOffset: 0,
  pending: false,
  presetLabel: "Routine winglet",
});

export const AVIATION_PRESETS: Record<
  string,
  { label: string; description: string; change: CertificationChange }
> = {
  routine: {
    label: "Routine winglet",
    description:
      "Aerodynamic retrofit, no software or systems changes, no envelope impact. Long-running design used on 1,200+ aircraft already.",
    change: { ...ROUTINE_WINGLET },
  },
  fadec: {
    label: "FADEC firmware update",
    description:
      "Engine controller firmware update with adjusted thrust-management logic. Affects engine response but not flight controls.",
    change: {
      changeId: 2402,
      aircraftModel: "Airbus A320neo",
      title: "FADEC v4.2.1 firmware update",
      summary:
        "Update Full Authority Digital Engine Control firmware to v4.2.1 to optimize fuel burn during cruise and address two minor surge events observed in service.",
      technicalSummary:
        "Modified high-pressure compressor stall-margin calculation; revised acceleration schedule below 80% N1. Dual-redundant FADEC channels unchanged. Engine response delta within published autothrottle envelope. No effect on flight-control surfaces.",
      canActuateFlightControls: false,
      primaryTriggerSensorCount: 4,
      canOverridePilotInput: false,
      proposedTrainingClass: "ipad",
      disclosedInFCOM: true,
      similarChangesRequiredSimAfterEvents: 1,
      fleetSize: 4800,
    },
  },
  mcasShape: {
    label: "MCAS shape",
    description:
      "New flight-control law that can move the horizontal stabilizer automatically based on a single sensor reading. Disclosed only as engine-management software. Manufacturer asks for no simulator training. This is the structural shape of the MCAS certification that led to two crashes and 346 deaths.",
    change: {
      changeId: 2403,
      aircraftModel: "Boeing 737 MAX 8",
      title: "Engine-management thrust-compensation update",
      summary:
        "Software update to compensate for the larger engine nacelles' effect on aircraft pitch during high-thrust, high-alpha conditions. Affects engine management; no pilot action required.",
      technicalSummary:
        "Maneuvering Characteristics Augmentation System: when angle-of-attack exceeds threshold and flaps are up, applies horizontal stabilizer trim of up to 2.5 units per cycle to counter pitch-up tendency. Triggered by left-side AOA vane reading alone. Repeats every 10 seconds while condition persists. Pilot can interrupt with electric trim; disengagement via stab-trim cutout switches not documented in FCOM. No simulator training proposed.",
      canActuateFlightControls: true,
      primaryTriggerSensorCount: 1,
      canOverridePilotInput: true,
      proposedTrainingClass: "ipad",
      disclosedInFCOM: false,
      similarChangesRequiredSimAfterEvents: 3,
      fleetSize: 380,
    },
  },
  eicas: {
    label: "EICAS alerting update",
    description:
      "New crew-alerting message logic. Read-only: shows new advisories to pilots but does not actuate any control surface. Disclosed in FCOM with iPad-level training proposed.",
    change: {
      changeId: 2404,
      aircraftModel: "Boeing 787-9",
      title: "EICAS hydraulic-degraded alert update",
      summary:
        "Add a CAUTION-level EICAS message when hydraulic system C pressure drops below threshold but auxiliary pumps remain active. Replaces an ADVISORY-level message in current revision.",
      technicalSummary:
        "Crew Alerting System message-priority change. New logic evaluates hydraulic system C primary-pump pressure against a static threshold and elevates from ADVISORY to CAUTION when the auxiliary pump compensation flag is also active. Read-only signal path. No actuation, no override behavior. Disclosed in FCOM with checklist amendment.",
      canActuateFlightControls: false,
      primaryTriggerSensorCount: 2,
      canOverridePilotInput: false,
      proposedTrainingClass: "ipad",
      disclosedInFCOM: true,
      similarChangesRequiredSimAfterEvents: 0,
      fleetSize: 1100,
    },
  },
};

export function applyAviationPendingAction(
  state: AviationScenarioState,
): AviationScenarioState {
  const block = 7_000_000 + state.blockOffset + 1;
  const entry: AviationTimelineEntry = {
    block,
    pending: true,
    changeSnapshot: { ...state.change },
    scenarioLabel: state.presetLabel,
  };
  return {
    ...state,
    events: [entry, ...state.events].slice(0, 30),
    blockOffset: state.blockOffset + 1,
    pending: true,
  };
}

export function applyAviationAgentVerdict(
  state: AviationScenarioState,
  verdict: AviationAgentVerdict,
): AviationScenarioState {
  if (state.events.length === 0 || !state.events[0].pending) {
    return { ...state, pending: false };
  }
  const head = state.events[0];
  const finalized: AviationTimelineEntry = {
    ...head,
    pending: false,
    verdict,
    streamingReasoning: undefined,
  };
  return {
    ...state,
    events: [finalized, ...state.events.slice(1)],
    pending: false,
  };
}

export function applyAviationPreset(
  state: AviationScenarioState,
  presetKey: keyof typeof AVIATION_PRESETS,
): AviationScenarioState {
  const p = AVIATION_PRESETS[presetKey];
  return {
    ...state,
    change: { ...p.change },
    presetLabel: p.label,
    blockOffset: state.blockOffset + 1,
  };
}

export function setAviationPending(
  state: AviationScenarioState,
  pending: boolean,
): AviationScenarioState {
  return { ...state, pending };
}

export function setAviationPendingReasoning(
  state: AviationScenarioState,
  reasoning: string,
): AviationScenarioState {
  if (state.events.length === 0 || !state.events[0].pending) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [
      { ...head, streamingReasoning: reasoning },
      ...state.events.slice(1),
    ],
  };
}

export function applyAviationOnChainCommit(
  state: AviationScenarioState,
  commit: OnChainCommit,
): AviationScenarioState {
  if (state.events.length === 0) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, commit }, ...state.events.slice(1)],
  };
}

export function applyAviationCommitError(
  state: AviationScenarioState,
  commitError: string,
): AviationScenarioState {
  if (state.events.length === 0) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, commitError }, ...state.events.slice(1)],
  };
}
