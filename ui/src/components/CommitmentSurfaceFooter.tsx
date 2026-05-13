/**
 * Slim footer block shown on each demo page. Surfaces:
 *   - the address of the commitment surface contract this demo writes to
 *   - the agent EOA that signs every verdict
 *   - a Basescan link for each
 *
 * Importable from any demo page; takes one prop (the key into
 * DEPLOYED_CONTRACTS).
 */

import {
  AGENT_EOA,
  DEPLOYED_CONTRACTS,
  basescanAddressUrl,
} from "@/lib/deployed-contracts";

type ContractKey = keyof typeof DEPLOYED_CONTRACTS;

interface Props {
  contract: ContractKey;
  /** When the demo is wired to actually post verdicts on-chain. */
  live?: boolean;
}

export function CommitmentSurfaceFooter({ contract, live = false }: Props) {
  const c = DEPLOYED_CONTRACTS[contract];
  return (
    <div className="border-t border-border mt-8 pt-5 pb-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[11px] mono">
        <span className="text-fg-mute uppercase tracking-wider">
          Commitment surface
        </span>
        <a
          href={basescanAddressUrl(c.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-coral hover:underline underline-offset-[3px] break-all"
        >
          {c.address}
        </a>
        <span className="text-fg-mute">on Base Sepolia</span>
        {live ? (
          <span className="badge badge-priced">Live verdicts posted</span>
        ) : (
          <span className="badge badge-stale">UI demo · contract live</span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[11px] mono mt-2">
        <span className="text-fg-mute uppercase tracking-wider">
          Agent (signs verdicts)
        </span>
        <a
          href={basescanAddressUrl(AGENT_EOA)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-fg-dim hover:text-fg underline-offset-[3px] hover:underline break-all"
        >
          {AGENT_EOA}
        </a>
      </div>
    </div>
  );
}
