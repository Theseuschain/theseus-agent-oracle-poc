"use client";

// Quill demo. One brief excerpt sits at the head of the page with
// span-level attribution shown by default. One affordance — verify
// a citation — runs against the agent's source set via a real
// deepseek call and either verifies, distinguishes, or flags
// fabrication in place.

import { useState } from "react";
import { shortHash } from "@/lib/poa/sim-sig";

const QUILL_KEY = "5PqW7xY4vK9bN2cR5tM8eA1dJ3fG6hL9oP4sZ7uX2wV5nQ";

type SpanKind = "full-ai" | "ai-assisted-edited" | "human";
type Span = {
  id: string;
  kind: SpanKind;
  text: string;
};

const BRIEF_SPANS: Span[] = [
  {
    id: "s1",
    kind: "human",
    text: "Plaintiff Bryant operated a continuous-feed aluminum extrusion press at Defendant's Joliet facility from March 2019 through November 2024. ",
  },
  {
    id: "s2",
    kind: "full-ai",
    text: "Plaintiff has standing to bring this action because the requirements of Article III are satisfied: an injury in fact, fairly traceable to Defendant's conduct, and redressable by a favorable decision.",
  },
  {
    id: "s3",
    kind: "ai-assisted-edited",
    text: " The injury is concrete and particularized: Plaintiff sustained quantifiable medical expenses and a permanent reduction in earning capacity directly resulting from Defendant's failure to maintain the extrusion press to OSHA-mandated specifications. ",
  },
  {
    id: "s4",
    kind: "full-ai",
    text: "Where, as here, an employer's documented failure to maintain workplace safety equipment causes a specific physical injury, traceability is established as a matter of law.",
  },
  {
    id: "s5",
    kind: "human",
    text: " Defendant's argument that Plaintiff's claim is preempted by the IL Workers' Compensation Act fails on its own terms; see Section II.C, infra.",
  },
];

const KIND_BG: Record<SpanKind, string> = {
  "full-ai":
    "color-mix(in srgb, var(--poa-wax, #4F46E5) 16%, transparent)",
  "ai-assisted-edited":
    "color-mix(in srgb, hsl(33 65% 60%) 18%, transparent)",
  human: "transparent",
};
const KIND_BORDER: Record<SpanKind, string> = {
  "full-ai": "color-mix(in srgb, var(--poa-wax, #4F46E5) 50%, var(--poa-rule))",
  "ai-assisted-edited": "color-mix(in srgb, hsl(33 65% 60%) 50%, var(--poa-rule))",
  human: "var(--poa-rule)",
};
const KIND_LABEL: Record<SpanKind, string> = {
  "full-ai": "full-ai",
  "ai-assisted-edited": "ai-assisted, edited",
  human: "human",
};

type CitationOutcome = "verified" | "distinguishable" | "fabricated";

const PRESET_CITATIONS: { label: string; citation: string; proposition: string }[] = [
  {
    label: "real & on-point",
    citation: "Bell Atl. Corp. v. Twombly, 550 U.S. 544, 555-57 (2007)",
    proposition:
      "Plaintiff's complaint must contain factual allegations that, taken as true, raise a right to relief above the speculative level.",
  },
  {
    label: "real, abrogated",
    citation: "Conley v. Gibson, 355 U.S. 41, 45-46 (1957)",
    proposition:
      "A complaint should not be dismissed unless it appears beyond doubt that the plaintiff can prove no set of facts in support of his claim.",
  },
  {
    label: "fabricated",
    citation: "In re Wakefield, 482 F. Supp. 3d 117 (S.D.N.Y. 2020)",
    proposition:
      "An employer's failure to maintain OSHA-compliant equipment constitutes per se negligence in worker-injury actions.",
  },
];

const OUTCOME_COLOR: Record<CitationOutcome, string> = {
  verified: "var(--poa-ink)",
  distinguishable: "hsl(33 65% 55%)",
  fabricated: "var(--poa-destructive, #e53e0c)",
};
const OUTCOME_LABEL: Record<CitationOutcome, string> = {
  verified: "verified",
  distinguishable: "real, abrogated",
  fabricated: "fabricated",
};

type LiveState =
  | { kind: "idle" }
  | { kind: "loading"; citation: string }
  | { kind: "no_key"; citation: string }
  | { kind: "error"; citation: string; message: string }
  | {
      kind: "ok";
      citation: string;
      proposition: string;
      outcome: CitationOutcome;
      responseBody: string;
      controlling: string | null;
      modelUsed: string;
      latencyMs: number;
    };

export default function QuillDemo() {
  const [citation, setCitation] = useState("");
  const [proposition, setProposition] = useState("");
  const [live, setLive] = useState<LiveState>({ kind: "idle" });

  async function submit(c: string, p: string) {
    const cit = c.trim();
    if (!cit) return;
    setCitation(cit);
    setProposition(p);
    setLive({ kind: "loading", citation: cit });
    try {
      const res = await fetch("/api/demo/quill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ citation: cit, proposition: p.trim() }),
      });
      if (res.status === 503) {
        setLive({ kind: "no_key", citation: cit });
        return;
      }
      if (res.status === 429) {
        setLive({
          kind: "error",
          citation: cit,
          message: "Rate limit hit (30 per hour per IP).",
        });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLive({
          kind: "error",
          citation: cit,
          message: err.message || "Model error",
        });
        return;
      }
      const data = await res.json();
      setLive({
        kind: "ok",
        citation: cit,
        proposition: p.trim(),
        outcome: data.outcome,
        responseBody: data.responseBody,
        controlling: data.controlling,
        modelUsed: data.modelUsed,
        latencyMs: data.latencyMs,
      });
    } catch (err) {
      setLive({
        kind: "error",
        citation: cit,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <section>
      <header className="mb-7">
        <h2 className="font-serif text-[28px] italic leading-tight text-[var(--poa-ink)]">
          Bryant v. Continental Aluminum
        </h2>
        <p className="mt-2 text-[12px] text-[var(--poa-ink-soft)]">
          Quill · Section II.B (Standing) · drafted 2026-04-12
        </p>
      </header>

      <p className="font-serif text-[15px] leading-[1.8] text-[var(--poa-ink)]">
        {BRIEF_SPANS.map((s) => (
          <span
            key={s.id}
            style={{
              background: KIND_BG[s.kind],
              borderBottom:
                s.kind === "human"
                  ? "none"
                  : `1.5px solid ${KIND_BORDER[s.kind]}`,
              paddingBottom: s.kind === "human" ? "0" : "1px",
            }}
          >
            {s.text}
          </span>
        ))}
      </p>

      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[var(--poa-ink-soft)]">
        {(["full-ai", "ai-assisted-edited", "human"] as SpanKind[]).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-8 rounded-sm"
              style={{
                background: KIND_BG[k],
                borderBottom:
                  k === "human" ? "none" : `1.5px solid ${KIND_BORDER[k]}`,
              }}
            />
            <span className="font-mono uppercase tracking-[0.14em]">
              {KIND_LABEL[k]}
            </span>
            <span>
              {BRIEF_SPANS.filter((s) => s.kind === k).length} spans
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-14">
        {live.kind === "idle" ? (
          <CitationForm
            citation={citation}
            setCitation={setCitation}
            proposition={proposition}
            setProposition={setProposition}
            onSubmit={() => submit(citation, proposition)}
            onPreset={(c, p) => submit(c, p)}
          />
        ) : (
          <CitationResult
            live={live}
            onReset={() => {
              setLive({ kind: "idle" });
              setCitation("");
              setProposition("");
            }}
          />
        )}
      </div>
    </section>
  );
}

function CitationForm({
  citation,
  setCitation,
  proposition,
  setProposition,
  onSubmit,
  onPreset,
}: {
  citation: string;
  setCitation: (s: string) => void;
  proposition: string;
  setProposition: (s: string) => void;
  onSubmit: () => void;
  onPreset: (c: string, p: string) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        type="text"
        value={citation}
        onChange={(e) => setCitation(e.target.value)}
        placeholder="Paste a citation to verify"
        maxLength={500}
        className="block w-full border-0 border-b bg-transparent py-2 text-[15px] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:border-[var(--poa-ink)] focus:outline-none"
        style={{ borderColor: "var(--poa-rule)" }}
      />
      <input
        type="text"
        value={proposition}
        onChange={(e) => setProposition(e.target.value)}
        placeholder="for what proposition (optional)"
        maxLength={1000}
        className="mt-2 block w-full border-0 border-b bg-transparent py-2 text-[14px] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:border-[var(--poa-ink)] focus:outline-none"
        style={{ borderColor: "var(--poa-rule)" }}
      />
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 text-[12px]">
        <p className="text-[var(--poa-ink-soft)]">
          or try:{" "}
          {PRESET_CITATIONS.map((p, i) => (
            <span key={p.label}>
              <button
                type="button"
                onClick={() => onPreset(p.citation, p.proposition)}
                className="italic underline decoration-[color:var(--poa-rule)] underline-offset-[3px] transition-colors hover:text-[var(--poa-ink)] hover:decoration-[color:var(--poa-ink)]"
              >
                {p.label}
              </button>
              {i < PRESET_CITATIONS.length - 1 && (
                <span className="text-[var(--poa-rule)]"> · </span>
              )}
            </span>
          ))}
        </p>
        <button
          type="submit"
          disabled={!citation.trim()}
          className="text-[var(--poa-ink)] transition-opacity hover:underline disabled:opacity-30 disabled:hover:no-underline"
        >
          verify →
        </button>
      </div>
    </form>
  );
}

function CitationResult({
  live,
  onReset,
}: {
  live: Exclude<LiveState, { kind: "idle" }>;
  onReset: () => void;
}) {
  const fabricated = live.kind === "ok" && live.outcome === "fabricated";
  return (
    <div
      className="border-l-2 pl-5"
      style={{
        borderColor: fabricated
          ? "var(--poa-destructive, #e53e0c)"
          : "var(--poa-rule)",
      }}
    >
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
        you cited
      </p>
      <p className="mt-1.5 font-mono text-[12.5px] leading-[1.55] text-[var(--poa-ink)]">
        {live.citation}
      </p>

      <div className="mt-5">
        {live.kind === "loading" && (
          <p className="text-[13px] text-[var(--poa-ink-soft)]">
            Quill is verifying…
          </p>
        )}
        {live.kind === "no_key" && (
          <p className="text-[13px] text-[var(--poa-ink-soft)]">
            The live verifier is offline (demo key not configured).
          </p>
        )}
        {live.kind === "error" && (
          <p
            className="text-[13px]"
            style={{ color: "var(--poa-destructive, #e53e0c)" }}
          >
            {live.message}
          </p>
        )}
        {live.kind === "ok" && (
          <>
            <p
              className="text-[10.5px] uppercase tracking-[0.18em]"
              style={{ color: OUTCOME_COLOR[live.outcome] }}
            >
              {OUTCOME_LABEL[live.outcome]}
            </p>
            <p className="mt-2 whitespace-pre-wrap font-serif text-[14px] leading-[1.7] text-[var(--poa-ink)]">
              {live.responseBody}
            </p>
            {live.controlling && (
              <p className="mt-3 font-mono text-[11px] leading-[1.5] text-[var(--poa-ink-soft)]">
                controlling: <span className="text-[var(--poa-ink)]">{live.controlling}</span>
              </p>
            )}
            <p className="mt-4 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
              signed {shortHash(QUILL_KEY)} · {live.latencyMs}ms
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-[12px] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)] hover:underline"
      >
        ← try another citation
      </button>
    </div>
  );
}
