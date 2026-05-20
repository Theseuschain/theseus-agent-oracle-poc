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

  const showReplayBanner = state.attestationAlreadyClaimed;
  const showFinalityBanner = state.finalizedHeight > state.sourceHeight;
  const showRoninBanner =
    !showReplayBanner &&
    !showFinalityBanner &&
    state.validatorSetRotated24h &&
    state.validatorsSigning === state.validatorQuorum;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
          source-chain state
        </p>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
          {presetLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
        <BigStat
          label="validator signatures"
          value={`${state.validatorsSigning} / ${state.validatorsTotal}`}
          sub={sigSubLabel}
          health={sigHealth}
        />
        <BigStat
          label="finality lag"
          value={`${finalityLag} blocks`}
          sub={finalitySubLabel}
          health={finalityHealth}
        />
      </div>

      <div className="mt-6 border-t border-border">
        <Row
          label="validator set rotated 24h"
          value={state.validatorSetRotated24h ? "yes" : "no"}
          health={rotationHealth}
        />
        <Row
          label="slashings 24h"
          value={String(state.recentSlashEvents24h)}
          health={slashHealth}
        />
        <Row
          label="replay state"
          value={state.attestationAlreadyClaimed ? "consumed" : "fresh"}
          sub="attestation nonce"
          health={replayHealth}
        />
        <Row label="attestation age" value={`${state.attestationAgeSec}s`} />
        <Row label="tvl" value={fmtUsd(state.tvlUsd)} />
        <Row
          label="withdraw pressure"
          value={`${(state.withdrawRate1h * 100).toFixed(2)}%/h`}
          sub={`${fmtUsd(hourlyOutflow)}/hour out`}
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

function healthStyle(h?: Health): React.CSSProperties {
  if (h === "crit") return { color: "var(--coral)" };
  if (h === "warn") return { color: "var(--fg)" };
  return { color: "var(--fg-mute)" };
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
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        {label}
      </p>
      <p
        className="serif mt-1 text-3xl tnum tracking-tight"
        style={health === "crit" ? { color: "var(--coral)" } : undefined}
      >
        {value}
      </p>
      <p
        className="mt-1 font-mono text-[10.5px]"
        style={healthStyle(health)}
      >
        {sub}
      </p>
    </div>
  );
}

function Row({
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
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <span className="font-mono text-[11.5px] text-fg-mute">{label}</span>
      <span className="flex items-baseline gap-3 text-right">
        <span
          className="font-mono tnum text-[13px]"
          style={health === "crit" ? { color: "var(--coral)" } : { color: "var(--fg)" }}
        >
          {value}
        </span>
        {sub && (
          <span
            className="font-mono text-[10.5px]"
            style={healthStyle(health)}
          >
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

function PreRunAlert({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="mt-5 border-l-2 pl-3"
      style={{ borderColor: "var(--coral)" }}
    >
      <p
        className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
        style={{ color: "var(--coral)" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-fg-mute">{body}</p>
    </div>
  );
}
