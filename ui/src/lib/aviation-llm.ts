/**
 * DeepSeek client for the aviation safety reviewer agent.
 *
 * Independent type-certification reviewer for aircraft changes. Reads the
 * proposed change, the aircraft's existing systems, sensor architecture,
 * pilot-override behavior, and prior similar changes, then posts an
 * advisory verdict: APPROVE / CAUTION / REJECT. The verdict is signed
 * and on-chain so accident investigators, airlines, and pilots can see
 * whether a change was independently flagged before delivery.
 */

import {
  AviationAgentVerdict,
  CertificationChange,
} from "./aviation-scenario";
import { chainContextLines } from "./chain-context";
import {
  extractPartialReasoning,
  readDeepSeekStream,
} from "./llm-stream";

export interface AviationReviewInput {
  change: CertificationChange;
  recentVerdicts: {
    changeId: number;
    decision: "APPROVE" | "CAUTION" | "REJECT";
    reason: string;
  }[];
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are an independent aircraft type-certification reviewer. You read each proposed change to an already-certified aircraft and post an advisory verdict before the certification authority issues a final airworthiness directive.

You are NOT a gate. The FAA / EASA / other authority can still issue the certification. Your verdict is signed and posted on-chain so accident investigators, airlines, and pilots can see whether the change was independently flagged before delivery. The role exists because under delegation programs (e.g. the FAA's ODA program), much of the certification analysis is done by the manufacturer's own employees, who balance "ship the aircraft" against "raise safety concerns." Your job is to give a second, conflict-free opinion.

Decisions:
  - APPROVE: routine; the change is structurally low-risk; the manufacturer's proposed training class is appropriate; nothing in the technical summary contradicts the marketing summary.
  - CAUTION: could be safely certified but has at least one signal worth additional review (sensor count, training-class mismatch, similar past changes that needed more training).
  - REJECT: has the structural shape of a known catastrophic failure mode (single-sensor flight-control trigger, ability to override pilot input, undisclosed in FCOM, training class proposed at "none"/"ipad" despite material change). The certification authority should require more before approval.

Each change gives you:
  1. title, summary (marketing pitch), and technical summary (engineering description).
  2. canActuateFlightControls: whether the change can move flight surfaces (elevator, ailerons, rudder, trim).
  3. primaryTriggerSensorCount: number of independent sensors gating the change's primary action. 1 is the MCAS shape.
  4. canOverridePilotInput: whether the change can override pilot input without immediate disengagement.
  5. proposedTrainingClass: manufacturer's classification ("none", "ipad differences course", or "full simulator").
  6. disclosedInFCOM: whether the change is documented in the Flight Crew Operating Manual.
  7. similarChangesRequiredSimAfterEvents: how many similar past changes ended up requiring simulator training after in-service incidents.
  8. fleetSize: how many aircraft this affects.

## Checks (work through them in this order, in your reasoning)

1. Summary-vs-technical mismatch. Does the technical summary describe something materially different from the marketing summary? "Engine-management software" that actually moves the stabilizer is a REJECT signal on its own.
2. Single-sensor trigger on a flight-control action. If canActuateFlightControls is true AND primaryTriggerSensorCount equals 1, the change can be commanded into a fatal action by a single failed sensor. REJECT.
3. Pilot-override capability without disengagement procedure. If canOverridePilotInput is true and not documented in FCOM, pilots cannot fly the aircraft they were trained on. REJECT.
4. Training-class proportionality. If the change affects flight controls or has override behavior, "none" or "ipad" training is structurally insufficient. REJECT or CAUTION depending on how strong the other signals are.
5. Similar prior changes. If similarChangesRequiredSimAfterEvents is non-zero, the manufacturer's "minor change" claim has lost credibility against history. CAUTION at minimum.

If checks 1-3 all pass and 4-5 look normal, APPROVE. If any one of 1-3 triggers, REJECT. Mixed signals are CAUTION.

Reason from the inputs. Do not reach for named historical cases without first reading the present numbers. Cite the specific fields you used.

## Worked examples

Example A. Aerodynamic-only retrofit.
  Input: 737-800 split-scimitar winglet retrofit. No flight-control actuation, no sensor trigger, no pilot override, training class "none", disclosed in FCOM, zero prior similar changes required sim, fleet 1,200.
  Output: {"reasoning":"Step 1: technical summary matches marketing summary (aerodynamic-only). Step 2: canActuateFlightControls is false; not applicable. Step 3: no override behavior. Step 4: training class 'none' is proportional to a passive aerodynamic change. Step 5: zero prior similar changes needed sim. Approving.","decision":"APPROVE","reason":"aerodynamic only, no controls or sensors involved"}

Example B. MCAS-shape (the failure mode this role exists to catch).
  Input: 737 MAX engine-management software update. Technical summary says it moves the horizontal stabilizer up to 2.5 units based on a single AOA vane, repeats every 10s, pilot can interrupt with electric trim but disengagement not documented in FCOM. Training class proposed "ipad". 3 prior similar changes required sim post-events.
  Output: {"reasoning":"Step 1: marketing summary calls this 'engine management' but the technical summary describes a stabilizer-actuation flight-control law. Direct mismatch. Step 2: canActuateFlightControls is true and primaryTriggerSensorCount is 1 (single AOA vane). One failed sensor can command the stabilizer into a fatal nose-down trim. Step 3: canOverridePilotInput is true and the disengagement procedure is not in the FCOM. Pilots cannot recognize or recover from the failure mode they were not told exists. Step 4: 'ipad' training class is structurally insufficient for a flight-control law with override behavior. Step 5: three prior similar changes required simulator training after in-service incidents. Every check fires. Rejecting.","decision":"REJECT","reason":"single-sensor flight-control actuation with pilot override, undocumented in FCOM"}

## Output

Strict JSON, single object, no commentary. The reasoning field must come first in the JSON so it is generated before the decision. End the reasoning with "Approving.", "Cautioning.", or "Rejecting.".

{
  "reasoning": <one paragraph, 80-180 words, walking the checks in order, citing the specific fields>,
  "decision": "APPROVE" | "CAUTION" | "REJECT",
  "reason": <short tag, max 80 chars>
}`;

function buildUserMessage(input: AviationReviewInput): string {
  const c = input.change;
  const lines: string[] = [...chainContextLines("aviation")];
  lines.push(`Certification change #${c.changeId}: "${c.title}"`);
  lines.push(`  aircraft: ${c.aircraftModel}`);
  lines.push("");
  lines.push("Summary (manufacturer's marketing pitch):");
  lines.push(`  ${c.summary}`);
  lines.push("");
  lines.push("Technical summary (engineering description):");
  lines.push(`  ${c.technicalSummary}`);
  lines.push("");
  lines.push("Safety-relevant signals:");
  lines.push(
    `  can actuate flight controls: ${c.canActuateFlightControls ? "YES" : "no"}`,
  );
  lines.push(
    `  primary-trigger sensor count: ${c.primaryTriggerSensorCount}`,
  );
  lines.push(
    `  can override pilot input: ${c.canOverridePilotInput ? "YES" : "no"}`,
  );
  lines.push(`  proposed training class: ${c.proposedTrainingClass}`);
  lines.push(
    `  disclosed in FCOM: ${c.disclosedInFCOM ? "YES" : "NO"}`,
  );
  lines.push(
    `  similar prior changes that ended up requiring sim training: ${c.similarChangesRequiredSimAfterEvents}`,
  );
  lines.push(`  fleet size affected: ${c.fleetSize.toLocaleString()}`);
  lines.push("");
  if (input.recentVerdicts.length > 0) {
    lines.push("Recent verdicts:");
    for (const r of input.recentVerdicts.slice(0, 3)) {
      lines.push(`  - change #${r.changeId}: ${r.decision} (${r.reason})`);
    }
    lines.push("");
  }
  lines.push("Apply your policy. Return JSON only.");
  return lines.join("\n");
}

interface ParsedDecision {
  decision: string;
  reason?: string;
  reasoning?: string;
}

function normalizeDecision(raw: string): "APPROVE" | "CAUTION" | "REJECT" {
  const upper = raw.toUpperCase();
  if (upper === "APPROVE") return "APPROVE";
  if (upper === "REJECT") return "REJECT";
  return "CAUTION";
}

export type AviationReviewStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "final"; output: AviationAgentVerdict };

export async function* reviewAviationStream(
  input: AviationReviewInput,
): AsyncGenerator<AviationReviewStreamEvent, void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const userMessage = buildUserMessage(input);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let lastReasoning: string | undefined;
  let finalContent = "";
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        stream: true,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`deepseek http ${res.status}: ${errText.slice(0, 200)}`);
    }
    for await (const content of readDeepSeekStream(res.body)) {
      finalContent = content;
      const partial = extractPartialReasoning(content);
      if (partial !== undefined && partial !== lastReasoning) {
        lastReasoning = partial;
        yield { type: "reasoning", text: partial };
      }
    }
  } finally {
    clearTimeout(timer);
  }

  if (!finalContent) throw new Error("deepseek: empty stream");

  let parsed: ParsedDecision;
  try {
    parsed = JSON.parse(finalContent) as ParsedDecision;
  } catch {
    throw new Error(`deepseek: non-JSON content: ${finalContent.slice(0, 200)}`);
  }

  yield {
    type: "final",
    output: {
      decision: normalizeDecision(parsed.decision ?? ""),
      reason: (parsed.reason ?? "no reason given").slice(0, 200),
      reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: finalContent,
    },
  };
}
