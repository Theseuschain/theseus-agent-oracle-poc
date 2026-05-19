// Landing card for an agent whose interactive demo is hosted on
// theseus.network/poa/<id>/demo (in-page, deepseek-chat powered) rather
// than rebuilt here from scratch. Lives on demo-agents to give the new
// non-adjudication agents (persona / NFT / collaborator / chronicler) a
// home on the demo-agents subdomain that doesn't 404 — the visitor sees
// the agent's identity here and gets one click to the working demo.

import Link from "next/link";

type Props = {
  /** Display name, e.g. "Vellum 1492". */
  name: string;
  /** Genus tag, e.g. "Generative author NFT". */
  kind: string;
  /** One-line pitch under the name. */
  pitch: string;
  /** Two- to four-paragraph description in the agent's voice. */
  description: string[];
  /** Capabilities tags (native-tools, schedule, etc.). */
  capabilities: { label: string; value: string }[];
  /** PoA profile URL. */
  poaUrl: string;
  /** Interactive demo URL on theseus.network. */
  interactiveDemoUrl: string;
};

export function HostedDemoCard(props: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 md:py-14">
      <header className="mb-8">
        <div className="eyebrow mb-2">{props.kind}</div>
        <h1 className="serif text-3xl md:text-4xl leading-[1.1] tracking-tight">
          {props.name}
        </h1>
        <p className="mono text-[13px] text-fg-dim mt-3">{props.pitch}</p>
      </header>

      <div className="surface p-6 md:p-8 mb-6">
        {props.description.map((p, i) => (
          <p
            key={i}
            className="text-[15px] leading-[1.7] text-fg first:mt-0 mt-4"
          >
            {p}
          </p>
        ))}
      </div>

      <div className="surface p-5 md:p-6 mb-6">
        <div className="eyebrow mb-3">Capabilities</div>
        <dl className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-x-4 gap-y-2">
          {props.capabilities.map((c) => (
            <div key={c.label} className="contents">
              <dt className="mono text-[10.5px] uppercase tracking-wider text-fg-dim">
                {c.label}
              </dt>
              <dd className="text-[13px] text-fg">{c.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="surface p-6 md:p-7 mb-6 border-l-2 border-coral">
        <div className="eyebrow mb-2">Interactive demo</div>
        <p className="text-[14px] text-fg leading-relaxed mb-4">
          The working demo for this agent is hosted on theseus.network. Free-
          form input, real <code className="mono text-[12px]">deepseek-chat</code>{" "}
          calls, signed output with simulated chain anchoring. Each call is
          rate-limited; no key needed to use the preset scenarios.
        </p>
        <a
          href={props.interactiveDemoUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-coral text-bg mono text-[12px] uppercase tracking-wider hover:opacity-90 transition"
        >
          Open the demo
          <span aria-hidden>→</span>
        </a>
      </div>

      <footer className="pt-4 mt-2 border-t border-border flex flex-wrap items-baseline justify-between gap-3">
        <Link
          href="/"
          className="mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
        >
          ← back to the directory
        </Link>
        <a
          href={props.poaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
        >
          See the credential on Proof of Agenthood ↗
        </a>
      </footer>
    </div>
  );
}
