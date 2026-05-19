// Small shared status / footer chip for the live LLM calls. Every demo
// surfaces a "powered by deepseek-chat · 1240ms" badge so a reviewer can
// tell the response was a real model call rather than a scripted one.

type Props =
  | { state: "loading"; message?: string }
  | {
      state: "no_key";
    }
  | { state: "ok"; modelUsed: string; latencyMs: number }
  | { state: "error"; message: string };

export default function LiveCallStatus(props: Props) {
  if (props.state === "loading") {
    return (
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
        {props.message ?? "calling deepseek-chat…"}
      </p>
    );
  }
  if (props.state === "no_key") {
    return (
      <p className="text-[12px] italic leading-relaxed text-[var(--poa-ink-soft)]">
        Demo running in scripted-fallback mode. Set{" "}
        <code className="font-mono text-[11px]">DEEPSEEK_API_KEY</code> in{" "}
        <code className="font-mono text-[11px]">.env.local</code> and restart
        the dev server to enable live model calls.
      </p>
    );
  }
  if (props.state === "ok") {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
        powered by {props.modelUsed} · {props.latencyMs}ms · real API call
      </p>
    );
  }
  return (
    <p
      className="text-[12px] leading-relaxed"
      style={{ color: "var(--poa-destructive, #C83B14)" }}
    >
      {props.message}
    </p>
  );
}
