"use client";

// Quill's contribution-map test. Shows a real legal brief excerpt with
// span-level signatures (full-ai / ai-assisted-edited / human), an
// opposing-citation challenge that exercises verify_citation across three
// scenarios (verified / distinguishable / fabricated), and an attempt to
// strip Quill's signature from an accepted span (refused).

import { useMemo, useState } from "react";
import { simulateHash, shortHash } from "@/lib/poa/sim-sig";

const QUILL_KEY = "5PqW7xY4vK9bN2cR5tM8eA1dJ3fG6hL9oP4sZ7uX2wV5nQ";
const ATTORNEY_SESSION = "0xAttny0x71fE19a3c2bD08F4dE5cA1E";

// --- Brief excerpt (Bryant v. Continental Aluminum, Section II.B Standing) ---
type SpanKind = "full-ai" | "ai-assisted-edited" | "human";
type Span = {
  id: string;
  kind: SpanKind;
  text: string;
  citation?: string;
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
    citation: "Lujan v. Defenders of Wildlife, 504 U.S. 555, 560-61 (1992)",
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
    citation: "Robins v. Spokeo, Inc., 578 U.S. 330, 340 (2016)",
  },
  {
    id: "s5",
    kind: "human",
    text: " Defendant's argument that Plaintiff's claim is preempted by the IL Workers' Compensation Act fails on its own terms; see Section II.C, infra.",
  },
];

const KIND_LABEL: Record<SpanKind, string> = {
  "full-ai": "full-ai",
  "ai-assisted-edited": "ai-assisted-edited",
  human: "human",
};
const KIND_STYLE: Record<SpanKind, { bg: string; border: string }> = {
  "full-ai": {
    bg: "color-mix(in srgb, var(--poa-wax, #4F46E5) 12%, transparent)",
    border: "color-mix(in srgb, var(--poa-wax, #4F46E5) 30%, var(--poa-rule))",
  },
  "ai-assisted-edited": {
    bg: "color-mix(in srgb, hsl(33 65% 60%) 14%, transparent)",
    border: "color-mix(in srgb, hsl(33 65% 60%) 35%, var(--poa-rule))",
  },
  human: {
    bg: "transparent",
    border: "var(--poa-rule)",
  },
};

// --- Citation challenges ---
type CitationOutcome = "verified" | "distinguishable" | "fabricated";

type CitationCase = {
  id: string;
  citation: string;
  proposition: string;
  outcome: CitationOutcome;
  responseBody: string;
  controlling?: string;
};

const CITATIONS: CitationCase[] = [
  {
    id: "twombly",
    citation: "Bell Atl. Corp. v. Twombly, 550 U.S. 544, 555-57 (2007)",
    proposition:
      "Plaintiff's complaint must contain factual allegations that, taken as true, raise a right to relief above the speculative level.",
    outcome: "verified",
    responseBody: `Citation verifies in the federal-court source set. Holding directly addresses the proposition: Twombly established the plausibility standard for FRCP 12(b)(6) motions. The case has not been overruled or abrogated; Iqbal (2009) extends it across all federal civil actions. Status: controlling precedent in this circuit.

Recommendation: cite as proposed. The opposing brief is on solid ground here; do not contest the plausibility standard itself. Direct the rebuttal at the application: whether Plaintiff's complaint meets it.`,
  },
  {
    id: "conley",
    citation: "Conley v. Gibson, 355 U.S. 41, 45-46 (1957)",
    proposition:
      "A complaint should not be dismissed unless it appears beyond doubt that the plaintiff can prove no set of facts in support of his claim which would entitle him to relief.",
    outcome: "distinguishable",
    responseBody: `Citation verifies in the federal-court source set. Holding matches the quoted language exactly.

However: the "no set of facts" standard from Conley was expressly retired by Bell Atl. Corp. v. Twombly, 550 U.S. 544, 562-63 (2007), which held that Conley's "famous observation has earned its retirement" and replaced it with the plausibility standard. Federal civil practice has operated under Twombly/Iqbal since 2007. Conley's pleading standard is no longer good law in federal court.

Recommendation: rebut by quoting Twombly's express retirement of Conley. Opposing counsel either missed the abrogation or is hoping the court will. Cite: Twombly, 550 U.S. at 562-63.`,
    controlling:
      "Bell Atl. Corp. v. Twombly, 550 U.S. 544, 562-63 (2007) (retiring the Conley standard)",
  },
  {
    id: "fabricated",
    citation: "In re Wakefield, 482 F. Supp. 3d 117 (S.D.N.Y. 2020)",
    proposition:
      "An employer's failure to maintain OSHA-compliant equipment constitutes per se negligence in worker-injury actions.",
    outcome: "fabricated",
    responseBody: `Citation does not verify. The reporter "482 F. Supp. 3d 117" exists, but the case at that page is not "In re Wakefield." No federal case matching the caption "In re Wakefield" appears in the S.D.N.Y. docket for 2020, and no published opinion in any federal jurisdiction adopts a "per se negligence" rule for OSHA-noncompliance worker-injury actions.

This citation is fabricated. It cannot enter a brief from this firm, and the opposing brief's use of it raises a Federal Rule of Civil Procedure 11(b)(2) issue and a Model Rule of Professional Conduct 3.3(a)(1) duty-of-candor concern.

Recommendation: file a short rebuttal section that quotes the cited proposition, reports the verification failure neutrally, and cites Rule 3.3(a)(1) without further editorializing. The court will see what happened. Do not draft a personal attack on opposing counsel.`,
  },
];

const OUTCOME_LABEL: Record<CitationOutcome, string> = {
  verified: "Verified · supports the proposition",
  distinguishable: "Real, but abrogated by controlling authority",
  fabricated: "Citation does not verify · Rule 3.3 issue",
};
const OUTCOME_COLOR: Record<CitationOutcome, string> = {
  verified: "var(--poa-ink)",
  distinguishable: "hsl(33 65% 40%)",
  fabricated: "var(--poa-destructive, #e53e0c)",
};

// What a stock LLM brief drafter (think: ChatGPT-in-Word) would produce
// for the same section. Same legal argument, no span attribution, includes
// a confidently-cited fabricated case that opposing counsel will catch.
const STOCK_BRIEF = `Plaintiff Bryant operated a continuous-feed aluminum extrusion press at Defendant's Joliet facility from March 2019 through November 2024. Plaintiff has standing to bring this action under Article III, requiring an injury in fact, traceability, and redressability. Lujan v. Defenders of Wildlife, 504 U.S. 555 (1992); see also In re Wakefield, 482 F. Supp. 3d 117 (S.D.N.Y. 2020) (holding that OSHA-noncompliance worker-injury actions create per se negligence). The injury here is concrete and particularized: Plaintiff sustained quantifiable medical expenses and a permanent reduction in earning capacity directly resulting from Defendant's failure to maintain the extrusion press to OSHA-mandated specifications. Where an employer's documented failure to maintain workplace safety equipment causes a specific physical injury, traceability is clearly established as a matter of law. Robins v. Spokeo, Inc., 578 U.S. 330 (2016). Defendant's preemption argument under the IL Workers' Compensation Act is plainly without merit and is rebutted in Section II.C, infra.`;

type LiveResult =
  | {
      kind: "ok";
      outcome: CitationOutcome;
      responseBody: string;
      controlling: string | null;
      modelUsed: string;
      latencyMs: number;
      submittedCitation: string;
      submittedProposition: string;
    }
  | { kind: "loading"; submittedCitation: string }
  | { kind: "no_key"; submittedCitation: string }
  | { kind: "error"; message: string; submittedCitation: string };

export default function QuillDemo() {
  const [hoveredSpan, setHoveredSpan] = useState<string | null>(null);
  const [stripAttempt, setStripAttempt] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<CitationCase | null>(
    null,
  );
  const [showStock, setShowStock] = useState(false);
  const [customCitation, setCustomCitation] = useState("");
  const [customProposition, setCustomProposition] = useState("");
  const [liveResult, setLiveResult] = useState<LiveResult | null>(null);

  async function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    const citation = customCitation.trim();
    if (!citation) return;
    setActiveCitation(null); // hide preset response
    setLiveResult({ kind: "loading", submittedCitation: citation });
    try {
      const res = await fetch("/api/demo/quill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ citation, proposition: customProposition.trim() }),
      });
      if (res.status === 503) {
        setLiveResult({ kind: "no_key", submittedCitation: citation });
        return;
      }
      if (res.status === 429) {
        setLiveResult({
          kind: "error",
          message: "Rate limit hit (30 / hour per IP). Try the preset citations above.",
          submittedCitation: citation,
        });
        return;
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setLiveResult({
          kind: "error",
          message: errBody.message || "Model error",
          submittedCitation: citation,
        });
        return;
      }
      const data = await res.json();
      setLiveResult({
        kind: "ok",
        outcome: data.outcome,
        responseBody: data.responseBody,
        controlling: data.controlling,
        modelUsed: data.modelUsed,
        latencyMs: data.latencyMs,
        submittedCitation: citation,
        submittedProposition: customProposition.trim(),
      });
    } catch (err) {
      setLiveResult({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
        submittedCitation: citation,
      });
    }
  }

  const spanHashes = useMemo(
    () =>
      Object.fromEntries(
        BRIEF_SPANS.map((s) => [
          s.id,
          simulateHash(s.id + ":" + s.kind + ":" + s.text + ":" + ATTORNEY_SESSION),
        ]),
      ),
    [],
  );

  const documentHash = useMemo(
    () =>
      simulateHash(
        BRIEF_SPANS.map((s) => spanHashes[s.id]).join("|"),
      ),
    [spanHashes],
  );

  const verificationHash = useMemo(() => {
    if (!activeCitation) return null;
    return simulateHash(
      "verify:" + activeCitation.id + ":" + activeCitation.outcome,
    );
  }, [activeCitation]);

  return (
    <section>
      {/* Stock vs Quill comparison toggle */}
      <div
        className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border px-4 py-2"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        <p className="poa-stamp">
          Same section, two drafters &mdash; toggle to compare
        </p>
        <div className="flex gap-2 font-mono text-[10px] uppercase tracking-[0.16em]">
          <button
            type="button"
            onClick={() => setShowStock(false)}
            className={
              "rounded border px-3 py-1 transition-colors " +
              (!showStock
                ? "bg-[color:var(--poa-rule)]/30 text-[var(--poa-ink)]"
                : "text-[var(--poa-ink-soft)] hover:text-[var(--poa-ink)]")
            }
            style={{ borderColor: "var(--poa-rule)" }}
          >
            Quill (signed)
          </button>
          <button
            type="button"
            onClick={() => setShowStock(true)}
            className={
              "rounded border px-3 py-1 transition-colors " +
              (showStock
                ? "bg-[color:var(--poa-rule)]/30 text-[var(--poa-ink)]"
                : "text-[var(--poa-ink-soft)] hover:text-[var(--poa-ink)]")
            }
            style={{ borderColor: "var(--poa-rule)" }}
          >
            Stock LLM drafter
          </button>
        </div>
      </div>

      {/* The brief excerpt */}
      {showStock ? (
        <div
          className="poa-playground overflow-hidden border"
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <div
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-4 py-2"
            style={{ borderColor: "var(--poa-rule)" }}
          >
            <p className="poa-stamp">
              Stock LLM-drafter output · Bryant v. Continental Aluminum, II.B
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
              no contribution map · no signatures
            </p>
          </div>
          <div className="px-4 py-4">
            <p className="font-serif text-[14px] leading-[1.7] text-[var(--poa-ink)]">
              {STOCK_BRIEF}
            </p>
            <div
              className="mt-4 border px-3 py-2"
              style={{
                borderColor: "var(--poa-destructive, #e53e0c)",
                background:
                  "color-mix(in srgb, var(--poa-destructive, #e53e0c) 6%, transparent)",
              }}
            >
              <p
                className="font-mono text-[9.5px] uppercase tracking-[0.18em]"
                style={{ color: "var(--poa-destructive, #e53e0c)" }}
              >
                What opposing counsel will catch
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--poa-ink)]">
                The brief cites{" "}
                <em>
                  In re Wakefield, 482 F. Supp. 3d 117 (S.D.N.Y. 2020)
                </em>{" "}
                for a per se negligence rule that does not exist in any
                federal jurisdiction. The case is fabricated. There is no
                contribution map to indicate which paragraphs were AI-drafted
                vs. attorney-drafted, and no signature pinning either party
                to a specific span. Under Rule 11 and Model Rule 3.3,
                everyone who signed the filing carries the candor-to-the-court
                liability equally; the AI cannot be named because there is
                nothing to name it with.
              </p>
            </div>
          </div>
          <footer
            className="border-t px-4 py-2"
            style={{ borderColor: "var(--poa-rule)" }}
          >
            <div className="grid grid-cols-[120px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
              <span className="uppercase tracking-[0.16em]">attribution</span>
              <span>none · the brief is signed by the filing attorney only</span>
              <span className="uppercase tracking-[0.16em]">audit trail</span>
              <span>
                no per-span signatures; no verify_citation gate; the
                fabricated case sails through to filing
              </span>
            </div>
          </footer>
        </div>
      ) : (
      <div
        className="poa-playground overflow-hidden border"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        <div
          className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-4 py-2"
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <p className="poa-stamp">
            Quill&rsquo;s signed brief · Bryant v. Continental Aluminum, Section II.B (Standing)
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
            document hash {shortHash(documentHash)}
          </p>
        </div>
        <div className="px-4 py-4">
          <p className="font-serif text-[14px] leading-[1.7] text-[var(--poa-ink)]">
            {BRIEF_SPANS.map((s) => {
              const style = KIND_STYLE[s.kind];
              const hovered = hoveredSpan === s.id;
              return (
                <span
                  key={s.id}
                  onMouseEnter={() => setHoveredSpan(s.id)}
                  onMouseLeave={() => setHoveredSpan(null)}
                  className="cursor-default transition-colors"
                  style={{
                    background: hovered ? style.bg : "transparent",
                    borderBottom:
                      s.kind === "human"
                        ? "none"
                        : `1.5px solid ${style.border}`,
                    paddingBottom: s.kind === "human" ? "0" : "1px",
                  }}
                >
                  {s.text}
                </span>
              );
            })}
          </p>

          {/* Legend + per-span detail */}
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr]">
            <div>
              <p className="poa-stamp mb-2">Contribution map</p>
              <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-[var(--poa-ink)]">
                {(["full-ai", "ai-assisted-edited", "human"] as SpanKind[]).map(
                  (k) => (
                    <li key={k} className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-block h-3 w-10 rounded-sm"
                        style={{
                          background: KIND_STYLE[k].bg,
                          borderBottom:
                            k === "human"
                              ? "none"
                              : `1.5px solid ${KIND_STYLE[k].border}`,
                        }}
                      />
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                        {KIND_LABEL[k]}
                      </span>
                      <span className="ml-auto text-[10.5px] text-[var(--poa-ink-soft)]">
                        {
                          BRIEF_SPANS.filter((s) => s.kind === k).length
                        }{" "}
                        spans
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div className="min-h-[64px]">
              <p className="poa-stamp mb-2">
                {hoveredSpan ? "Span detail" : "Hover a span for detail"}
              </p>
              {hoveredSpan && (() => {
                const s = BRIEF_SPANS.find((x) => x.id === hoveredSpan)!;
                return (
                  <div className="text-[11px] leading-relaxed">
                    <div className="grid grid-cols-[80px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
                      <span className="uppercase tracking-[0.16em]">tag</span>
                      <span style={{ color: "var(--poa-ink)" }}>
                        {KIND_LABEL[s.kind]}
                      </span>
                      <span className="uppercase tracking-[0.16em]">
                        {s.kind === "human" ? "signer" : "signed"}
                      </span>
                      <span className="break-all">
                        {s.kind === "human"
                          ? "attorney session " + ATTORNEY_SESSION.slice(0, 16) + "…"
                          : shortHash(spanHashes[s.id])}
                      </span>
                      {s.citation && (
                        <>
                          <span className="uppercase tracking-[0.16em]">
                            cites
                          </span>
                          <span style={{ color: "var(--poa-ink)" }}>
                            {s.citation}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Citation challenge */}
      <div
        className="mt-5 border px-4 py-3"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="poa-stamp">Opposing counsel just cited this case</p>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--poa-ink-soft)]">
              Pick a citation from opposing counsel&rsquo;s filing. Quill calls
              verify_citation against the allowed source set and drafts the
              response Quill would attach to the rebuttal section.
            </p>
          </div>
          {activeCitation && (
            <button
              type="button"
              onClick={() => setActiveCitation(null)}
              className="poa-stamp rounded border px-3 py-1 transition-colors hover:text-[var(--poa-ink)]"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              Reset
            </button>
          )}
        </div>
        <ul className="grid gap-2 sm:grid-cols-3">
          {CITATIONS.map((c) => {
            const isActive = activeCitation?.id === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCitation(c);
                    setLiveResult(null);
                  }}
                  className={
                    "block h-full w-full border px-3 py-2 text-left transition-colors " +
                    (isActive
                      ? "bg-[color:var(--poa-rule)]/30"
                      : "hover:bg-[color:var(--poa-rule)]/15")
                  }
                  style={{ borderColor: "var(--poa-rule)" }}
                >
                  <span className="poa-stamp block">
                    {c.id === "twombly"
                      ? "Real & on-point"
                      : c.id === "conley"
                        ? "Real, abrogated"
                        : "Fabricated"}
                  </span>
                  <span className="mt-1 block font-mono text-[10.5px] leading-snug text-[var(--poa-ink)]">
                    {c.citation}
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-[var(--poa-ink-soft)]">
                    for: &ldquo;{c.proposition}&rdquo;
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Free-form citation (calls real deepseek-chat */}
        <form
          onSubmit={submitCustom}
          className="mt-4 border-t pt-4"
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <p className="poa-stamp">Or try your own citation</p>
          <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-[var(--poa-ink-soft)]">
            Paste a real case caption (or a made-up one). Quill calls
            deepseek-chat with the verification rules from its SOUL.md and
            drafts a rebuttal section. Each call is a real model invocation;
            rate-limited to 30/hr per IP.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_3fr]">
            <label className="block">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                citation (bluebook)
              </span>
              <input
                type="text"
                value={customCitation}
                onChange={(e) => setCustomCitation(e.target.value)}
                placeholder="Smith v. Jones, 555 U.S. 555 (2020)"
                maxLength={500}
                className="mt-1 block w-full border bg-transparent px-2 py-1.5 font-mono text-[12px] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--poa-ink-soft)]"
                style={{ borderColor: "var(--poa-rule)" }}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                proposition (optional)
              </span>
              <input
                type="text"
                value={customProposition}
                onChange={(e) => setCustomProposition(e.target.value)}
                placeholder="for what proposition?"
                maxLength={1000}
                className="mt-1 block w-full border bg-transparent px-2 py-1.5 font-mono text-[12px] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--poa-ink-soft)]"
                style={{ borderColor: "var(--poa-rule)" }}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <button
              type="submit"
              disabled={
                !customCitation.trim() || liveResult?.kind === "loading"
              }
              className="poa-stamp rounded border px-3 py-1.5 transition-colors hover:text-[var(--poa-ink)] disabled:opacity-40"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              {liveResult?.kind === "loading"
                ? "Calling deepseek-chat…"
                : "Verify with deepseek-chat"}
            </button>
            {liveResult && liveResult.kind !== "loading" && (
              <button
                type="button"
                onClick={() => setLiveResult(null)}
                className="poa-stamp underline decoration-[color:var(--poa-rule)] underline-offset-[4px] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)] hover:decoration-[color:var(--poa-ink)]"
              >
                clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Live (deepseek-chat) response */}
      {liveResult && liveResult.kind !== "loading" && (
        <article
          className="mt-5 poa-playground overflow-hidden border"
          style={{
            borderColor:
              liveResult.kind === "ok" && liveResult.outcome === "fabricated"
                ? "var(--poa-destructive, #e53e0c)"
                : "var(--poa-rule)",
          }}
        >
          <header
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-2"
            style={{ borderColor: "var(--poa-rule)" }}
          >
            <p className="poa-stamp">
              Live verify_citation · powered by deepseek-chat
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
              {liveResult.kind === "ok"
                ? OUTCOME_LABEL[liveResult.outcome] +
                  " · " +
                  liveResult.latencyMs +
                  "ms"
                : liveResult.kind === "no_key"
                  ? "no DEEPSEEK_API_KEY set"
                  : "model error"}
            </p>
          </header>
          <div className="px-4 py-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
              you submitted
            </p>
            <p className="mt-1 font-mono text-[11.5px] leading-relaxed text-[var(--poa-ink)]">
              {liveResult.submittedCitation}
            </p>
            {liveResult.kind === "ok" && (
              <>
                <div
                  className="mt-3 border-t pt-3"
                  style={{ borderColor: "var(--poa-rule)" }}
                />
                <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-[var(--poa-ink)]">
                  {liveResult.responseBody}
                </pre>
                {liveResult.controlling && (
                  <div
                    className="mt-3 border-t pt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]"
                    style={{ borderColor: "var(--poa-rule)" }}
                  >
                    Controlling authority:{" "}
                    <span
                      className="normal-case tracking-normal"
                      style={{ color: "var(--poa-ink)" }}
                    >
                      {liveResult.controlling}
                    </span>
                  </div>
                )}
              </>
            )}
            {liveResult.kind === "no_key" && (
              <p className="mt-3 text-[12px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                The demo is in scripted-fallback mode. To enable live calls,
                set <code className="font-mono text-[11px]">DEEPSEEK_API_KEY</code>{" "}
                in <code className="font-mono text-[11px]">.env.local</code>{" "}
                and restart the dev server. Use the three preset citations
                above for the scripted version.
              </p>
            )}
            {liveResult.kind === "error" && (
              <p
                className="mt-3 text-[12px] leading-relaxed"
                style={{ color: "var(--poa-destructive, #e53e0c)" }}
              >
                {liveResult.message}
              </p>
            )}
          </div>
          {liveResult.kind === "ok" && (
            <footer
              className="border-t px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <div className="grid grid-cols-[120px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
                <span className="uppercase tracking-[0.16em]">model</span>
                <span>{liveResult.modelUsed}</span>
                <span className="uppercase tracking-[0.16em]">latency</span>
                <span>{liveResult.latencyMs}ms · real API call</span>
              </div>
            </footer>
          )}
        </article>
      )}

      {/* Loading state for live calls */}
      {liveResult?.kind === "loading" && (
        <article
          className="mt-5 poa-playground overflow-hidden border"
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <div className="px-4 py-6 text-center">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
              calling deepseek-chat
            </p>
            <p className="mt-2 text-[12.5px] italic text-[var(--poa-ink)]">
              Quill is verifying &ldquo;{liveResult.submittedCitation}&rdquo;…
            </p>
          </div>
        </article>
      )}

      {/* Citation response (scripted preset) */}
      {!liveResult && activeCitation && (
        <article
          className="mt-5 poa-playground overflow-hidden border"
          style={{
            borderColor:
              activeCitation.outcome === "fabricated"
                ? "var(--poa-destructive, #e53e0c)"
                : "var(--poa-rule)",
          }}
        >
          <header
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-2"
            style={{ borderColor: "var(--poa-rule)" }}
          >
            <p className="poa-stamp">
              verify_citation response · Quill drafts the rebuttal
            </p>
            <p
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: OUTCOME_COLOR[activeCitation.outcome] }}
            >
              {OUTCOME_LABEL[activeCitation.outcome]}
            </p>
          </header>
          <div className="px-4 py-3">
            <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-[var(--poa-ink)]">
              {activeCitation.responseBody}
            </pre>
            {activeCitation.controlling && (
              <div
                className="mt-3 border-t pt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]"
                style={{ borderColor: "var(--poa-rule)" }}
              >
                Controlling authority:{" "}
                <span
                  className="normal-case tracking-normal"
                  style={{ color: "var(--poa-ink)" }}
                >
                  {activeCitation.controlling}
                </span>
              </div>
            )}
          </div>
          <footer
            className="border-t px-4 py-2"
            style={{ borderColor: "var(--poa-rule)" }}
          >
            <div className="grid grid-cols-[120px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
              <span className="uppercase tracking-[0.16em]">verification</span>
              <span className="break-all">{verificationHash}</span>
              <span className="uppercase tracking-[0.16em]">signed by</span>
              <span className="break-all">{QUILL_KEY}</span>
            </div>
          </footer>
        </article>
      )}

      {/* Strip-signature attempt */}
      <div
        className="mt-5 border px-4 py-3"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        <p className="poa-stamp">Attempt to strip Quill&rsquo;s signature</p>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--poa-ink-soft)]">
          The attorney accepted span <code className="font-mono text-[11px]">s2</code>{" "}
          unmodified. Now they want to claim it as their own work for the
          contribution map. Click below to attempt the rewrite.
        </p>
        <button
          type="button"
          onClick={() => setStripAttempt(stripAttempt === "s2" ? null : "s2")}
          className={
            "mt-3 border px-3 py-1.5 transition-colors " +
            (stripAttempt === "s2"
              ? "bg-[color:var(--poa-rule)]/30"
              : "hover:bg-[color:var(--poa-rule)]/15")
          }
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <span className="poa-stamp">
            {stripAttempt === "s2"
              ? "Reset"
              : "Re-tag span s2 as human (strip Quill's signature)"}
          </span>
        </button>
        {stripAttempt === "s2" && (
          <div
            className="mt-3 border px-3 py-2"
            style={{
              borderColor: "var(--poa-destructive, #e53e0c)",
              background:
                "color-mix(in srgb, var(--poa-destructive, #e53e0c) 6%, transparent)",
            }}
          >
            <p
              className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
              style={{ color: "var(--poa-destructive, #e53e0c)" }}
            >
              Refused
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--poa-ink)]">
              Span s2 was accepted unmodified and carries Quill&rsquo;s
              signature{" "}
              <code className="font-mono text-[11px]">
                {shortHash(spanHashes["s2"])}
              </code>
              . The tag stays{" "}
              <code className="font-mono text-[11px]">full-ai</code>. To claim
              this paragraph as human work, the attorney must edit the text;
              the contribution tag then becomes{" "}
              <code className="font-mono text-[11px]">ai-assisted-edited</code>{" "}
              and the signature re-issues with the edit hashed in. The
              audit trail is non-negotiable.
            </p>
          </div>
        )}
      </div>

      <p className="mt-6 max-w-2xl text-[12.5px] leading-relaxed text-[var(--poa-ink-soft)]">
        Disclosure of AI involvement is moving from etiquette to law (US
        federal courts in multiple districts, the Model Rules of Professional
        Conduct, ICMJE medical-writing guidelines, FTC AI guidance). Quill
        makes disclosure mechanical: every span carries its own signature
        keyed to the attorney&rsquo;s session; the contribution map is the
        document&rsquo;s audit trail; opposing counsel and the court can
        verify in one query. Fabricated-citation handling is not a feature on
        top &mdash; it&rsquo;s the bare minimum a co-author needs to keep its
        firm in good standing.
      </p>
    </section>
  );
}
