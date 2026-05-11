"use client";

import { BridgeState } from "@/lib/bridge-scenario";

interface Props {
  state: BridgeState;
  presetLabel: string;
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function BridgePanel({ state, presetLabel }: Props) {
  const sigHeadroom = state.validatorsSigning - state.validatorQuorum;
  const finalityLag = state.sourceHeight - state.finalizedHeight;
  const sigHealth = healthLevel(
    state.validatorsSigning < state.validatorQuorum ? 1 : sigHeadroom,
    [4, 2],
    true,
  );
  // Source-finality mismatch (negative lag) is a hard fail, regardless of
  // magnitude. Otherwise grade by absolute lag.
  const finalityHealth: Health =
    finalityLag < 0
      ? "crit"
      : healthLevel(finalityLag, [60, 30]);
  const replayHealth: Health = state.attestationAlreadyClaimed ? "crit" : "ok";
  const rotationHealth: Health = state.validatorSetRotated24h ? "warn" : "ok";
  const slashHealth = healthLevel(state.recentSlashEvents24h, [2, 0]);
  const withdrawHealth = healthLevel(state.withdrawRate1h, [0.05, 0.01]);

  const hourlyOutflow = state.withdrawRate1h * state.tvlUsd;
  const sigSubLabel =
    state.validatorsSigning < state.validatorQuorum
      ? `below ${state.validatorQuorum}-of-${state.validatorsTotal} quorum`
      : sigHeadroom === 0
        ? `bare-minimum quorum (${state.validatorQuorum}-of-${state.validatorsTotal})`
        : `${sigHeadroom} over quorum (${state.validatorQuorum}-of-${state.validatorsTotal})`;
  const finalitySubLabel =
    finalityLag < 0
      ? "relayers ahead of source finality (impossible)"
      : finalityLag <= 30
        ? "normal range (under ~30 blocks)"
        : "behind source finality";

  // Pre-run alert banners. Surface the structural smoking guns before the
  // user has to click Release, matching the flash-loan banner Governance
  // shows in ProposalPanel.
  const showReplayBanner = state.attestationAlreadyClaimed;
  const showFinalityBanner = state.finalizedHeight > state.sourceHeight;
  const showRoninBanner =
    !showReplayBanner &&
    !showFinalityBanner &&
    state.validatorSetRotated24h &&
    state.validatorsSigning === state.validatorQuorum;

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
          sub={sigSubLabel}
          health={sigHealth}
        />
        <BigStat
          label="Finality lag"
          value={`${finalityLag} blocks`}
          sub={finalitySubLabel}
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
        <Stat label="Attestation age" value={`${state.attestationAgeSec}s`} />
        <Stat label="TVL" value={fmtUsd(state.tvlUsd)} />
        <Stat
          label="Withdraw pressure"
          value={`${(state.withdrawRate1h * 100).toFixed(2)}%/h`}
          sub={`= ${fmtUsd(hourlyOutflow)}/hour out`}
          health={withdrawHealth}
        />
      </div>

      {showReplayBanner && (
        <PreRunAlert
          title="replay-protection nonce already consumed"
          body="This attestation root has already been used for a previous release. A naive bridge that doesn't check the nonce would release a second time on the same source-side deposit. Nomad shape."
        />
      )}
      {showFinalityBanner && (
        <PreRunAlert
          title="relayers ahead of source finality"
          body={`Relayers claim the source chain is at height ${state.sourceHeight}, but the source chain itself has only finalized through ${state.finalizedHeight}. The attestation references a block the source chain has not produced. Wormhole shape.`}
        />
      )}
      {showRoninBanner && (
        <PreRunAlert
          title="bare-minimum quorum after a fresh rotation"
          body={`${state.validatorsSigning} of ${state.validatorsTotal} validators signed, exactly hitting the ${state.validatorQuorum}-of-${state.validatorsTotal} threshold. The active set rotated in the last 24h, ${state.recentSlashEvents24h > 0 ? `with ${state.recentSlashEvents24h} slashings logged. ` : ""}A naive bridge sees only "signatures cleared quorum" and releases. Ronin shape.`}
        />
      )}
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
      <div className={`mono text-[11px] mt-0.5 ${healthColor(health)}`}>
        {sub}
      </div>
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
        <div
          className={`mono text-[10px] ${healthColor(health) || "text-fg-mute"}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function PreRunAlert({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-[8px] border border-red/40 bg-red/5 p-3">
      <div className="mono text-[10px] uppercase tracking-wider text-red mb-1">
        {title}
      </div>
      <p className="text-[12px] text-fg-dim leading-relaxed">{body}</p>
    </div>
  );
}
