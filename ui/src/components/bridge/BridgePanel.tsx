"use client";

import { BridgeState } from "@/lib/bridge-scenario";

interface Props {
  state: BridgeState;
  presetLabel: string;
}

export function BridgePanel({ state, presetLabel }: Props) {
  const sigRatio = state.validatorsSigning / state.validatorsTotal;
  const finalityLag = state.sourceHeight - state.finalizedHeight;
  const sigHealth = healthLevel(
    state.validatorsSigning < state.validatorQuorum
      ? 1
      : state.validatorsSigning - state.validatorQuorum,
    [4, 2],
    true,
  );
  const finalityHealth = healthLevel(Math.abs(finalityLag), [60, 30]);
  const replayHealth: Health = state.attestationAlreadyClaimed ? "crit" : "ok";
  const rotationHealth: Health = state.validatorSetRotated24h ? "warn" : "ok";
  const slashHealth = healthLevel(state.recentSlashEvents24h, [2, 0]);
  const withdrawHealth = healthLevel(state.withdrawRate1h, [0.05, 0.01]);

  return (
    <div className="surface p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="eyebrow mb-1">Source-chain state</div>
          <div className="serif text-2xl">Cross-chain bridge</div>
        </div>
        <span className="badge badge-stale">{presetLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-5">
        <BigStat
          label="Validator signatures"
          value={`${state.validatorsSigning} / ${state.validatorsTotal}`}
          sub={`${(sigRatio * 100).toFixed(0)}%; quorum ${state.validatorQuorum}`}
          health={sigHealth}
        />
        <BigStat
          label="Finality lag"
          value={`${finalityLag} blocks`}
          sub={
            finalityLag < 0
              ? "relayers ahead of source finality"
              : "behind source finality"
          }
          health={finalityHealth}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
        <Stat
          label="Validator set rotated 24h"
          value={state.validatorSetRotated24h ? "yes" : "no"}
          health={rotationHealth}
        />
        <Stat
          label="Slashings 24h"
          value={String(state.recentSlashEvents24h)}
          health={slashHealth}
        />
        <Stat
          label="Replay state"
          value={state.attestationAlreadyClaimed ? "consumed" : "fresh"}
          sub="attestation nonce"
          health={replayHealth}
        />
        <Stat
          label="Attestation age"
          value={`${state.attestationAgeSec}s`}
        />
        <Stat
          label="TVL"
          value={`$${(state.tvlUsd / 1e6).toFixed(0)}M`}
        />
        <Stat
          label="Withdraw pressure"
          value={`${(state.withdrawRate1h * 100).toFixed(2)}%/h`}
          sub="of TVL"
          health={withdrawHealth}
        />
      </div>
    </div>
  );
}

type Health = "ok" | "warn" | "crit";

// healthLevel: pass a positive number, higher means worse by default.
// inverted=true flips the polarity (higher means better, used for the
// signing-headroom metric where more headroom is better).
function healthLevel(
  value: number,
  [warn, crit]: [number, number],
  inverted = false,
): Health {
  if (inverted) {
    if (value <= crit) return "crit";
    if (value <= warn) return "warn";
    return "ok";
  }
  if (value >= crit) return "crit";
  if (value >= warn) return "warn";
  return "ok";
}

function healthColor(h?: Health): string {
  if (h === "crit") return "text-red";
  if (h === "warn") return "text-amber";
  return "text-green";
}

function BigStat({
  label,
  value,
  sub,
  health,
}: {
  label: string;
  value: string;
  sub: string;
  health: Health;
}) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="serif text-3xl tnum">{value}</div>
      <div className={`mono text-[11px] mt-0.5 ${healthColor(health)}`}>{sub}</div>
    </div>
  );
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
        <div className={`mono text-[10px] ${healthColor(health) || "text-fg-mute"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
