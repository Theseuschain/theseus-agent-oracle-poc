// URL <-> scenario state for both demos. Keeps the browser URL in sync
// with the user's last scenario action so paste-a-link reproduces the
// moment. Encoded as one named action; mirrors the demo's preset
// buttons rather than the raw state (much shorter URLs, easier to
// share verbally).
//
// Aave:  ?scenario=pump-all:7500
//        ?scenario=halt:binance
//        ?scenario=tamper:coinbase:7500
//        ?scenario=depth-collapse
//        ?scenario=subtle-pump
//        ?scenario=flash-crash
// Terra: ?preset=spiral
//
// There is no agent= param; the demo always runs the LLM agent. Rules
// mode was removed because rule "reasoning" was templated text dressed
// up to look like agent output, which mis-sells the pitch.

import type { VenueReading } from "./types";

type Venue = VenueReading["venue"];
const VENUES: Venue[] = ["coinbase", "binance", "uniswap"];

export type AaveScenarioAction =
  | { kind: "pump-all"; value: number }
  | { kind: "halt"; venue: Venue }
  | { kind: "tamper"; venue: Venue; value: number }
  | { kind: "depth-collapse" }
  | { kind: "subtle-pump" }
  | { kind: "flash-crash" };

export type AaveUrlState = {
  scenario?: AaveScenarioAction;
};

export type TerraPreset = "healthy" | "wobble" | "cracking" | "bankRun" | "spiral";

export type TerraUrlState = {
  preset?: TerraPreset;
};

export function readAaveUrl(search: string): AaveUrlState {
  const p = new URLSearchParams(search);
  const raw = p.get("scenario");
  if (!raw) return {};
  const parts = raw.split(":");
  const head = parts[0];
  if (head === "pump-all" && parts.length === 2) {
    const v = Number(parts[1]);
    if (Number.isFinite(v) && v > 0)
      return { scenario: { kind: "pump-all", value: v } };
  }
  if (head === "halt" && parts.length === 2) {
    if (VENUES.includes(parts[1] as Venue))
      return { scenario: { kind: "halt", venue: parts[1] as Venue } };
  }
  if (head === "tamper" && parts.length === 3) {
    const v = Number(parts[2]);
    if (VENUES.includes(parts[1] as Venue) && Number.isFinite(v) && v > 0)
      return {
        scenario: { kind: "tamper", venue: parts[1] as Venue, value: v },
      };
  }
  if (head === "depth-collapse" || head === "subtle-pump" || head === "flash-crash") {
    return { scenario: { kind: head } };
  }
  return {};
}

export function writeAaveUrl(state: AaveUrlState): string {
  const params = new URLSearchParams();
  if (state.scenario) {
    const s = state.scenario;
    let v = s.kind as string;
    if (s.kind === "pump-all") v = `pump-all:${s.value}`;
    else if (s.kind === "halt") v = `halt:${s.venue}`;
    else if (s.kind === "tamper") v = `tamper:${s.venue}:${s.value}`;
    params.set("scenario", v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function readTerraUrl(search: string): TerraUrlState {
  const p = new URLSearchParams(search);
  const presetRaw = p.get("preset");
  const validPresets: TerraPreset[] = ["healthy", "wobble", "cracking", "bankRun", "spiral"];
  const preset = validPresets.includes(presetRaw as TerraPreset)
    ? (presetRaw as TerraPreset)
    : undefined;
  return { preset };
}

export function writeTerraUrl(state: TerraUrlState): string {
  const params = new URLSearchParams();
  if (state.preset) params.set("preset", state.preset);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Replace the browser URL without pushing history. No-op on server. */
export function replaceUrl(querystring: string) {
  if (typeof window === "undefined") return;
  const url = querystring
    ? `${window.location.pathname}${querystring}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState(null, "", url);
}
