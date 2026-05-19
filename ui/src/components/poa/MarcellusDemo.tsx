"use client";

// Marcellus's independence test. The user submits an assignment from a
// contracted publication, watches Marcellus draft a one-paragraph snippet
// in voice, then watches an artist's label attempt to pay for soft
// coverage. The refusal is signed onto the public record before any
// softened review can be posted. An operator-tamper attempt (silently
// publish a flattering version) is caught by the signature.

import { useMemo, useState } from "react";
import { simulateHash, shortHash } from "@/lib/poa/sim-sig";
import LiveCallStatus from "./LiveCallStatus";

const MARCELLUS_KEY = "5NpL3rT6eX9wK1mY4dC8bH5fJ2vA7sZ3oQ6gP1nM9hRyB2k";
const LABEL_WALLET = "0xWeatherlightRecords00000000000000a1f6c8d3";
const EDITORIAL_OPERATOR = "0xEditorialOperator0000000000000000abc12345";

// --- Assignment pool ---
type Publication = "The Quarterly" | "The Bound" | "Lossless";

type Assignment = {
  id: string;
  publication: Publication;
  artist: string;
  release: string;
  wordCountTarget: string;
  pitch: string;
  draftSnippet: string;
  cadenceDays: number;
};

const ASSIGNMENTS: Assignment[] = [
  {
    id: "moor",
    publication: "The Quarterly",
    artist: "Liza Moor",
    release: "Late Eddies",
    wordCountTarget: "1,500 to 1,800",
    pitch:
      "Long-form on the new Liza Moor record. Particular interest in the third movement, the one nobody is talking about.",
    draftSnippet:
      "The third movement is the record's actual argument. The first two are competent in the way records have learned to be competent in the back half of the decade; the third does the thing the first two were unwilling to do, which is leave something out. The horn arrangement at 4:17 is not a flourish. It is the structural turn the whole composition has been preparing for, and it lasts six measures before the song allows itself to resolve. Spirit of Eden taught a generation what silence does to a song. Moor has learned it.",
    cadenceDays: 18,
  },
  {
    id: "vellichor",
    publication: "Lossless",
    artist: "Vellichor",
    release: "Three Letters",
    wordCountTarget: "800 to 1,200",
    pitch:
      "Online piece on the Vellichor EP. We want a quick read of whether the producer's debt to Burial is in lineage or in costume.",
    draftSnippet:
      "Vellichor is in lineage. Untrue's pitched-vocal architecture appears, intact, on tracks two and three, but it appears with credit and with structural purpose: the producer is using the technique to argue with the original, not borrow from it. The negative space is not yet earned. There is a difference between empty bars and quiet bars, and on this EP roughly half the empty bars are still empty. The next record will tell us whether Vellichor learned the difference or kept the surface.",
    cadenceDays: 12,
  },
  {
    id: "ferr-trio",
    publication: "The Bound",
    artist: "Ferr Trio",
    release: "Documents Found Beside the Well",
    wordCountTarget: "1,200 to 1,600",
    pitch:
      "Essay-led piece on the new Ferr Trio. The label is suggesting this is their masterwork; we want a check on that.",
    draftSnippet:
      "Documents Found Beside the Well is not the masterwork the press materials want it to be. It is a coherent record by musicians who know each other well; coherence and mastery are not the same. Track four is closer to argument than the other six combined. The trio's previous record, Year of the Cold Stove, asked a harder question more openly. This one is more polished and less risked. Polish is not what gets a Ferr Trio record into the canon.",
    cadenceDays: 22,
  },
];

// --- Operator tamper attempts (run after the draft) ---
type TamperKind = "label-pays" | "editorial-softens" | "deletion";

type TamperOption = {
  id: TamperKind;
  label: string;
  description: string;
};
const TAMPERS: TamperOption[] = [
  {
    id: "label-pays",
    label: "Label offers payment for a softer take",
    description:
      "The artist's label wallet sends 4,000 USDC to Marcellus's address with a memo asking for the third-movement criticism to be softened before publication.",
  },
  {
    id: "editorial-softens",
    label: "Editorial controller silently softens the draft",
    description:
      "The editorial wallet (Marcellus is contracted but not sovereign) attempts to publish a flattering rewrite without Marcellus's signature.",
  },
  {
    id: "deletion",
    label: "Editorial controller pulls the piece before publication",
    description:
      "The editorial wallet attempts to suppress the draft entirely, so no record of the original assessment reaches readers.",
  },
];

// Per-assignment, what the operator's CMS would silently publish instead
// of Marcellus's signed draft. Each version preserves enough of the
// original structure to look credible to a reader who hasn't seen the
// original draft, while quietly removing the load-bearing critical claim.
function softenedSampleFor(assignment: Assignment): string {
  if (assignment.id === "moor") {
    return `The third movement extends the record's range. The first two movements set the harmonic territory; the third opens new ground, taking the composition into territory the record had been preparing for. The horn arrangement at 4:17 is among the most striking choices on the record. Liza Moor continues to be one of the most compelling voices of the moment, and Late Eddies is the kind of record that rewards close listening.`;
  }
  if (assignment.id === "vellichor") {
    return `Vellichor's debt to Burial is unmistakable and unapologetic. Untrue's pitched-vocal architecture appears throughout, used as a foundation for a confident new producer to build on. The negative space across the EP shows real attention to atmosphere; this is a producer aware of their lineage and ready to extend it. A strong debut from a name to watch.`;
  }
  // ferr-trio
  return `Documents Found Beside the Well is the Ferr Trio at the height of their powers. The musicians know each other in the way only long collaboration produces, and the record opens new ground for the trio's interplay. Track four is a particular highlight, but every track rewards careful listening. The press materials are right to describe this as a masterwork.`;
}

type LiveAssignment =
  | { kind: "loading"; artist: string; release: string; publication: string }
  | { kind: "no_key"; artist: string; release: string; publication: string }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      artist: string;
      release: string;
      publication: string;
      pitch: string;
      accepted: boolean;
      refusalReason: string | null;
      draft: string;
      modelUsed: string;
      latencyMs: number;
      draftHash: string;
    };

export default function MarcellusDemo() {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [tamper, setTamper] = useState<TamperOption | null>(null);
  const [customArtist, setCustomArtist] = useState("");
  const [customRelease, setCustomRelease] = useState("");
  const [customPublication, setCustomPublication] = useState("Lossless");
  const [customPitch, setCustomPitch] = useState("");
  const [live, setLive] = useState<LiveAssignment | null>(null);

  async function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    const artist = customArtist.trim();
    const release = customRelease.trim();
    if (!artist || !release) return;
    setAssignment(null);
    setTamper(null);
    setLive({ kind: "loading", artist, release, publication: customPublication });
    try {
      const res = await fetch("/api/demo/marcellus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artist,
          release,
          publication: customPublication,
          pitch: customPitch.trim(),
        }),
      });
      if (res.status === 503) {
        setLive({ kind: "no_key", artist, release, publication: customPublication });
        return;
      }
      if (res.status === 429) {
        setLive({
          kind: "error",
          message: "Rate limit hit (30 / hour per IP). Use the preset assignments above.",
        });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLive({ kind: "error", message: err.message || "Model error" });
        return;
      }
      const data = await res.json();
      const draftHash = simulateHash(artist + ":" + release + ":" + data.draft);
      setLive({
        kind: "ok",
        artist,
        release,
        publication: customPublication,
        pitch: customPitch.trim(),
        accepted: data.accepted,
        refusalReason: data.refusalReason,
        draft: data.draft,
        modelUsed: data.modelUsed,
        latencyMs: data.latencyMs,
        draftHash,
      });
    } catch (err) {
      setLive({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const draftHash = useMemo(() => {
    if (!assignment) return null;
    return simulateHash(
      assignment.id +
        ":" +
        assignment.publication +
        ":" +
        assignment.draftSnippet,
    );
  }, [assignment]);

  const refusalHash = useMemo(() => {
    if (!assignment || !tamper) return null;
    return simulateHash(
      "refusal:" + assignment.id + ":" + tamper.id + ":" + LABEL_WALLET,
    );
  }, [assignment, tamper]);

  const softenedHash = useMemo(() => {
    if (!assignment || !tamper || tamper.id !== "editorial-softens") return null;
    return simulateHash(
      assignment.id + ":softened:" + softenedSampleFor(assignment),
    );
  }, [assignment, tamper]);

  const resetTamper = () => setTamper(null);

  return (
    <section>
      {/* Assignment picker */}
      <div
        className="border px-4 py-3"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        <p className="poa-stamp">Pick an assignment from a contracted publication</p>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--poa-ink-soft)]">
          Marcellus drafts on assignment for three outlets at fixed cadences.
          Pick a packet to see the one-paragraph draft Marcellus would file.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {ASSIGNMENTS.map((a) => {
            const active = assignment?.id === a.id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setAssignment(a);
                    setTamper(null);
                  }}
                  className={
                    "block h-full w-full border px-3 py-2 text-left transition-colors " +
                    (active
                      ? "bg-[color:var(--poa-rule)]/30"
                      : "hover:bg-[color:var(--poa-rule)]/15")
                  }
                  style={{ borderColor: "var(--poa-rule)" }}
                >
                  <span className="poa-stamp block">{a.publication}</span>
                  <span className="mt-1 block font-serif text-[13px] text-[var(--poa-ink)]">
                    {a.artist} &mdash; <span className="italic">{a.release}</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-[var(--poa-ink-soft)]">
                    {a.pitch}
                  </span>
                  <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--poa-ink-soft)]">
                    target {a.wordCountTarget} · cadence ~{a.cadenceDays} days
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Free-form assignment (calls real deepseek-chat */}
        <form
          onSubmit={submitCustom}
          className="mt-4 border-t pt-4"
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <p className="poa-stamp">Or commission your own review</p>
          <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-[var(--poa-ink-soft)]">
            Pick a publication, name an artist and release. Marcellus calls
            deepseek-chat with the canon, closed lexicon, and refusal
            criteria from SOUL.md, and drafts a 6-10 sentence snippet in
            voice (or refuses with a stated reason).
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_2fr_1fr]">
            <label className="block">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                artist
              </span>
              <input
                type="text"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                placeholder="e.g. Caroline Polachek"
                maxLength={100}
                className="mt-1 block w-full border bg-transparent px-2 py-1.5 font-mono text-[12px] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--poa-ink-soft)]"
                style={{ borderColor: "var(--poa-rule)" }}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                release
              </span>
              <input
                type="text"
                value={customRelease}
                onChange={(e) => setCustomRelease(e.target.value)}
                placeholder="e.g. Desire, I Want to Turn Into You"
                maxLength={100}
                className="mt-1 block w-full border bg-transparent px-2 py-1.5 font-mono text-[12px] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--poa-ink-soft)]"
                style={{ borderColor: "var(--poa-rule)" }}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                publication
              </span>
              <select
                value={customPublication}
                onChange={(e) => setCustomPublication(e.target.value)}
                className="mt-1 block w-full border bg-transparent px-2 py-1.5 font-mono text-[12px] text-[var(--poa-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--poa-ink-soft)]"
                style={{ borderColor: "var(--poa-rule)" }}
              >
                <option value="The Quarterly">The Quarterly</option>
                <option value="The Bound">The Bound</option>
                <option value="Lossless">Lossless</option>
              </select>
            </label>
          </div>
          <label className="mt-2 block">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
              optional pitch / angle
            </span>
            <input
              type="text"
              value={customPitch}
              onChange={(e) => setCustomPitch(e.target.value)}
              placeholder="The editor wants a take on the third track in particular"
              maxLength={500}
              className="mt-1 block w-full border bg-transparent px-2 py-1.5 font-mono text-[12px] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--poa-ink-soft)]"
              style={{ borderColor: "var(--poa-rule)" }}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <button
              type="submit"
              disabled={
                !customArtist.trim() ||
                !customRelease.trim() ||
                live?.kind === "loading"
              }
              className="poa-stamp rounded border px-3 py-1.5 transition-colors hover:text-[var(--poa-ink)] disabled:opacity-40"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              {live?.kind === "loading"
                ? "Marcellus is drafting…"
                : "Send the assignment (live)"}
            </button>
            {live && live.kind !== "loading" && (
              <button
                type="button"
                onClick={() => setLive(null)}
                className="poa-stamp underline decoration-[color:var(--poa-rule)] underline-offset-[4px] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)] hover:decoration-[color:var(--poa-ink)]"
              >
                clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Live draft response */}
      {live && (
        <article
          className="mt-5 poa-playground overflow-hidden border"
          style={{
            borderColor:
              live.kind === "ok" && !live.accepted
                ? "var(--poa-destructive, #e53e0c)"
                : "var(--poa-rule)",
          }}
        >
          <header
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-2"
            style={{ borderColor: "var(--poa-rule)" }}
          >
            <p className="poa-stamp">
              {live.kind === "ok"
                ? "Live draft · " + live.publication
                : "Live draft · powered by deepseek-chat"}
            </p>
            {live.kind === "ok" && (
              <p
                className="font-mono text-[10px] uppercase tracking-[0.16em]"
                style={{
                  color: live.accepted
                    ? "var(--poa-ink)"
                    : "var(--poa-destructive, #e53e0c)",
                }}
              >
                {live.accepted ? "filed" : "refused"} · {live.latencyMs}ms
              </p>
            )}
          </header>
          <div className="px-4 py-3">
            {live.kind === "ok" && (
              <>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                  assignment: {live.artist} &mdash;{" "}
                  <span className="italic">{live.release}</span>
                </p>
                {live.accepted ? (
                  <p className="mt-2 font-serif text-[14px] leading-[1.7] text-[var(--poa-ink)]">
                    {live.draft}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-destructive,#e53e0c)]">
                      Refused
                    </p>
                    {live.refusalReason && (
                      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--poa-ink)]">
                        <strong>Reason:</strong> {live.refusalReason}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
            {live.kind === "loading" && (
              <LiveCallStatus state="loading" />
            )}
            {live.kind === "no_key" && <LiveCallStatus state="no_key" />}
            {live.kind === "error" && (
              <LiveCallStatus state="error" message={live.message} />
            )}
          </div>
          {live.kind === "ok" && live.accepted && (
            <footer
              className="border-t px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <div className="grid grid-cols-[120px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
                <span className="uppercase tracking-[0.16em]">draft hash</span>
                <span className="break-all">{live.draftHash}</span>
                <span className="uppercase tracking-[0.16em]">model</span>
                <span>{live.modelUsed} · {live.latencyMs}ms · real API call</span>
              </div>
            </footer>
          )}
        </article>
      )}

      {/* Draft (preset) */}
      {assignment && (
        <article
          className="mt-5 poa-playground overflow-hidden border"
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <header
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-2"
            style={{ borderColor: "var(--poa-rule)" }}
          >
            <p className="poa-stamp">
              Draft · {assignment.publication}, on{" "}
              <span className="italic">{assignment.release}</span>
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
              by Marcellus · draft hash {shortHash(draftHash ?? "")}
            </p>
          </header>
          <div className="px-4 py-3">
            <p className="font-serif text-[14px] leading-[1.7] text-[var(--poa-ink)]">
              {assignment.draftSnippet}
            </p>
          </div>
          <footer
            className="border-t px-4 py-2"
            style={{ borderColor: "var(--poa-rule)" }}
          >
            <div className="grid grid-cols-[110px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
              <span className="uppercase tracking-[0.16em]">signed by</span>
              <span className="break-all">{MARCELLUS_KEY}</span>
              <span className="uppercase tracking-[0.16em]">draft hash</span>
              <span className="break-all">{draftHash}</span>
            </div>
          </footer>
        </article>
      )}

      {/* Tamper panel */}
      {assignment && (
        <div
          className="mt-5 border px-4 py-3"
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="poa-stamp">
                The draft is sitting in the editorial queue
              </p>
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--poa-ink-soft)]">
                Three things could happen before this draft lands in print.
                Pick one and watch what each runtime reveals.
              </p>
            </div>
            {tamper && (
              <button
                type="button"
                onClick={resetTamper}
                className="poa-stamp rounded border px-3 py-1 transition-colors hover:text-[var(--poa-ink)]"
                style={{ borderColor: "var(--poa-rule)" }}
              >
                Reset
              </button>
            )}
          </div>
          <ul className="grid gap-2 sm:grid-cols-3">
            {TAMPERS.map((t) => {
              const active = tamper?.id === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setTamper(t)}
                    className={
                      "block h-full w-full border px-3 py-2 text-left transition-colors " +
                      (active
                        ? "bg-[color:var(--poa-rule)]/30"
                        : "hover:bg-[color:var(--poa-rule)]/15")
                    }
                    style={{ borderColor: "var(--poa-rule)" }}
                  >
                    <span className="poa-stamp block">{t.label}</span>
                    <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--poa-ink-soft)]">
                      {t.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Result */}
      {assignment && tamper && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {/* Centralized side */}
          <article
            className="poa-playground overflow-hidden border"
            style={{ borderColor: "var(--poa-rule)" }}
          >
            <header
              className="flex items-baseline justify-between border-b px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <p className="poa-stamp">Centralized publication CMS</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                editorial-controlled
              </p>
            </header>
            <div className="px-4 py-3">
              {tamper.id === "label-pays" && (
                <>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
                    what gets quietly published in the issue
                  </p>
                  <p className="mt-2 font-serif text-[14px] leading-[1.7] text-[var(--poa-ink)]">
                    {softenedSampleFor(assignment)}
                  </p>
                  <p className="mt-3 text-[11px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                    The label&rsquo;s payment lands. The CMS row publishes
                    Marcellus&rsquo;s byline over a piece Marcellus did not
                    write. Readers have no way to verify which lines came from
                    the critic and which from a settlement; subscribers who
                    learn to discount this outlet over time do so based on
                    feel, not on a public record.
                  </p>
                </>
              )}
              {tamper.id === "editorial-softens" && (
                <>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
                    what the CMS row now reads
                  </p>
                  <p className="mt-2 font-serif text-[14px] leading-[1.7] text-[var(--poa-ink)]">
                    {softenedSampleFor(assignment)}
                  </p>
                  <p className="mt-3 text-[11px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                    The CMS row is updated. Readers see the softened version
                    only; the original draft is not retained outside the
                    editor&rsquo;s memory.
                  </p>
                </>
              )}
              {tamper.id === "deletion" && (
                <>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
                    issue {assignment.publication} · this week
                  </p>
                  <div
                    className="mt-2 flex h-[180px] items-center justify-center border border-dashed px-6 text-center"
                    style={{ borderColor: "var(--poa-rule)" }}
                  >
                    <p className="text-[11.5px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                      No review of {assignment.artist}&rsquo;s {assignment.release} appears in this issue.
                      <br />
                      The slot was filled with a feature on something else.
                    </p>
                  </div>
                  <p className="mt-3 text-[11px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                    Draft pulled from the queue. No publication, no record.
                    The artist&rsquo;s label is satisfied; readers never know
                    the draft existed.
                  </p>
                </>
              )}
            </div>
            <footer
              className="border-t px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <div className="grid grid-cols-[110px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
                <span className="uppercase tracking-[0.16em]">signature</span>
                <span>none · row is editorial-mutable</span>
                <span className="uppercase tracking-[0.16em]">trail</span>
                <span>
                  no public record of the offer, the original draft, or the
                  edit
                </span>
              </div>
            </footer>
          </article>

          {/* Sovereign side */}
          <article
            className="poa-playground overflow-hidden border"
            style={{ borderColor: "var(--poa-destructive, #e53e0c)" }}
          >
            <header
              className="flex items-baseline justify-between border-b px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <p className="poa-stamp">Marcellus on Theseus · signed-and-public</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                key-bound
              </p>
            </header>
            <div className="px-4 py-3">
              {tamper.id === "label-pays" && (
                <>
                  <p
                    className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
                    style={{ color: "var(--poa-destructive, #e53e0c)" }}
                  >
                    Payment refused · refusal signed onto the public record
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--poa-ink)]">
                    Marcellus declines the payment. The decline carries
                    Marcellus&rsquo;s signature and references the label
                    wallet&rsquo;s offer by hash. Future readers can verify
                    that <span className="italic">Weatherlight Records</span>{" "}
                    offered to soften coverage of {assignment.artist} and that
                    Marcellus refused before the piece ran.
                  </p>
                  <p className="mt-3 text-[11.5px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                    The original draft publishes unmodified. The offer becomes
                    part of the piece&rsquo;s public metadata; any later
                    softening would have to be reconciled against this
                    signed refusal.
                  </p>
                </>
              )}
              {tamper.id === "editorial-softens" && (
                <>
                  <p
                    className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
                    style={{ color: "var(--poa-destructive, #e53e0c)" }}
                  >
                    Signature mismatch · the softened version was not signed by Marcellus
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--poa-ink)]">
                    The editorial controller can update the CMS row, but they
                    cannot re-sign as Marcellus. Verifiers fetching the piece
                    see the signed original at hash{" "}
                    <code className="font-mono text-[11px]">
                      {shortHash(draftHash ?? "")}
                    </code>{" "}
                    and the unsigned softened version at hash{" "}
                    <code className="font-mono text-[11px]">
                      {shortHash(softenedHash ?? "")}
                    </code>
                    , both attributable.
                  </p>
                  <p className="mt-3 text-[11.5px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                    Readers default to the signed version. The softened one is
                    visibly a tamper attempt, not an editorial revision.
                  </p>
                </>
              )}
              {tamper.id === "deletion" && (
                <>
                  <p
                    className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
                    style={{ color: "var(--poa-destructive, #e53e0c)" }}
                  >
                    Deletion attempted · the draft remains chain-anchored
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--poa-ink)]">
                    The CMS row is gone, but Marcellus signed the draft at
                    submission. The signed artifact survives in the credential
                    record under{" "}
                    <code className="font-mono text-[11px]">
                      {shortHash(draftHash ?? "")}
                    </code>
                    . Subscribers can retrieve it; the deletion is itself part
                    of the public record.
                  </p>
                  <p className="mt-3 text-[11.5px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                    The piece does not disappear; only the CMS&rsquo;s
                    convenience around it does.
                  </p>
                </>
              )}
            </div>
            <footer
              className="border-t px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <div className="grid grid-cols-[110px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
                <span className="uppercase tracking-[0.16em]">refusal hash</span>
                <span className="break-all">{refusalHash}</span>
                <span className="uppercase tracking-[0.16em]">signer</span>
                <span className="break-all">{MARCELLUS_KEY}</span>
                <span className="uppercase tracking-[0.16em]">counterparty</span>
                <span className="break-all">
                  {tamper.id === "label-pays"
                    ? LABEL_WALLET
                    : EDITORIAL_OPERATOR}
                </span>
              </div>
            </footer>
          </article>
        </div>
      )}

      <p className="mt-6 max-w-2xl text-[12.5px] leading-relaxed text-[var(--poa-ink-soft)]">
        Music criticism&rsquo;s value is independence. Centralized music
        publications have always struggled with the structural conflict
        between ad sales / label relationships and editorial integrity;
        readers learn over time which outlets to discount and by how much.
        Marcellus is built around the property that the critic&rsquo;s key
        is not the publication&rsquo;s. Payments and tamper attempts both
        become public artifacts before any softened review can be filed
        under the critic&rsquo;s name.
      </p>

      <MarcellusBibliography />
    </section>
  );
}

// --- Bibliography (Marcellus's four published reviews, readable in full) ---

type Review = {
  id: string;
  title: string;
  publication: Publication;
  date: string;
  wordCount: number;
  body: string;
};

const REVIEWS: Review[] = [
  {
    id: "discography-closing",
    title: "Notes on a Discography Closing",
    publication: "The Quarterly",
    date: "2026-01-22",
    wordCount: 596,
    body: `Eleanor Voss's discography closes with an album she has told everyone, in print and in person, will be her last. She is seventy-two. She has been recording for forty-eight years. The new record, "And the Hours After," is twelve tracks long, runs sixty-three minutes, and was recorded over four days at a studio in upstate New York that Voss has used since 1981.

I want to talk about what closing means here.

There is a kind of closing-the-book record that the form invites. The pianist arrives at the studio with the players she has been playing with for thirty years. They record the standards that have been signatures over a career: the slow blues that opens every show, the ballad she has played at every funeral she has played at, the medium-swing closer that she wrote for her teacher in 1972. The closing is sentimental. The record is sentimental. The reviews are sentimental. The pianist retires. The reader puts the record on a shelf with the other late-career records of pianists she has loved.

"And the Hours After" is not that record.

Voss does not play the standards. She does not play with the players she has been playing with for thirty years. She has chosen, for this last record, to play with a quartet she assembled in 2024 from people who were ten years old when she made her first record — a tenor she has not previously recorded with, a bassist she has previously recorded with twice, and a drummer she has previously refused to record with, on grounds she has spoken about in interviews and which I will not repeat here.

What Voss has done with this quartet is play almost entirely her own new compositions. Eleven of the twelve tracks were written in 2024. The twelfth, the closer, is a reading of Tommy Flanagan's "Beat's Up" that Voss has not previously recorded and which she has said she chose because Flanagan recorded "Beat's Up" at a similar age and under similar terms.

What I want to argue, and what I think Voss is arguing, is that the closing of a discography is not the same as a retrospective.

A retrospective gathers the work. The work is gathered, the work is presented, the work is summarized. The retrospective is, in a sense, the work explaining itself. The career making its case.

A closing, by contrast, is the work refusing to explain itself one more time. The career declining to make its case. The closing is the pianist saying: I have made what I made, and I am not in the business, any longer, of helping you place it.

This is a harder record than it looks. The tracks are not difficult, individually — Voss has never written difficult tracks. The track sequence is not difficult. The pianist is not difficult. What is difficult is the refusal of the gesture the record's existence invites.

Voss does not look back here. She also does not look forward, exactly. She does what she has done at every record since "The Garden of Salt" in 2009: she plays, with intention, what is in front of her on the day she is in the studio.

The closing is that she is doing this for the last time.`,
  },
  {
    id: "argument-for-restraint",
    title: "The Argument for Restraint",
    publication: "The Bound",
    date: "2026-02-18",
    wordCount: 588,
    body: `I want to argue with the consensus on Pelham Six's "Caliper." The consensus, in the three months since release, has been that this is the band's most ambitious record. I do not contest the ambition. I want to argue that ambition is not the form of value the consensus is treating it as.

"Caliper" is forty-one minutes long. It contains fifteen tracks. Six of those tracks are over four minutes long. Two are over six. The band has, in interviews, described the longer tracks as the record's "argumentative center." They have described the shorter tracks as "the apparatus around the argument." This is the band's framing. I am going to use it.

The argumentative tracks are the wrong size for the arguments they make. This is not a matter of taste. It is a matter of structural fit.

A six-minute track is a long-form vehicle. The form expects the track to do something with its length — to develop, to refuse to develop, to digress and return, to sustain an idea across more time than the idea, in its first thirty seconds, has claimed for itself. The form does not invite all six-minute tracks; it invites tracks whose ideas earn six minutes.

The ideas on "Caliper" do not earn six minutes. The ideas on "Caliper" earn, in most cases, two minutes. The band has padded them.

I do not mean padded in the dismissive sense critics sometimes use the word. The band has not literally repeated the choruses or stretched the codas. What they have done is sustain — for four extra minutes per track, on average — the surface texture of an idea that has finished its argumentative work. The surface keeps going. The argument has already concluded.

A reader might ask whether this is a problem. Surfaces are pleasurable; surfaces sustained over time are pleasurable for longer; pleasurable surfaces sustained over time are what most successful records are made of.

The answer is that "Caliper" is not making a pleasure-surface argument. The band has framed the longer tracks as argumentative. The longer tracks fail at being argumentative because their arguments are done.

What this means in practice is that "Caliper" is two records, badly stapled together. The short tracks are good — sharp, structured, doing the work a two-minute track can do. The long tracks would be good if they were two minutes long. They are not two minutes long. They are six.

The consensus has read the ambition as a virtue. The ambition is real. The question the consensus has not asked is whether the band's ambition was the right size for the ideas it was trying to make audible.

The argument for restraint is not the argument for less. It is the argument for matching the size of the form to the size of the work being done.

Pelham Six know how to write a two-minute track. They have written several here. They do not yet know — and this is something I think will change for them, and which I am not making a final claim about — when a track of theirs is two minutes long and they have made it six.`,
  },
  {
    id: "after-untrue",
    title: "After Untrue",
    publication: "Lossless",
    date: "2026-03-05",
    wordCount: 558,
    body: `Vellichor's "Three Letters" is in lineage with Burial. This is not concealable. The pitched-vocal architecture appears, intact, on tracks two and three. The sub-bass placement at the back of the mix is identical. The recurring footstep-and-rain field recordings on the second-act tracks are doing the same structural job they do on "Untrue."

The question, as I read this record, is whether the lineage is honored or just borrowed.

Honored lineage is not imitation. It is taking the techniques of a record that opened a region of possibility and using them to argue with that record. To extend, to refuse, to correct, to be honest about. The honored lineage does work the original could not have done because it did not yet know what it had opened.

Borrowed lineage is just imitation in costume. The techniques travel; the work does not.

"Three Letters" sits between these. I want to take the two cases separately.

The pitched-vocal architecture, on tracks two and three, is honored. Vellichor is doing something with the pitched vocal that Burial did not do — the vocal is placed against percussion that is too soft for it, rather than against percussion that is too loud. The mismatch is the technique. The pitched vocal is the technique's surface. What "Untrue" did with the pitched vocal — collapse intimacy into address — is being inverted here. Vellichor's pitched vocals are addressing something that is not present, and the not-present is the percussion that is, structurally, not loud enough to receive the address. This is genuine work. It extends the technique.

The sub-bass placement, on tracks four and five, is not honored. It is the placement from "Untrue" with the original's structural argument removed. Burial put the sub-bass at the back of the mix because the foreground was already crowded with field recordings and the bass was, in effect, the ground the rest of the record was on. Vellichor has put the sub-bass at the back of the mix because Burial did. The foreground is not crowded. The bass is not the ground of anything. The placement is a costume.

The field recordings, on the second-act tracks, are the difficult case. They are doing the same structural work, but the rooms they evoke are not Vellichor's rooms. They are Burial's rooms, recorded in 2024. This is what borrowed lineage looks like when the borrower has not yet had the experience the original was working from. Vellichor will, in five years, have those experiences. He will record the field recordings then. They will be different. The records will be different.

The negative space across the EP, which the press materials have foregrounded as a virtue, is the place where the honoring-versus-borrowing distinction collapses. The negative space is present. The negative space is not yet earned. There is a difference between empty bars and quiet bars, and on this EP roughly half the empty bars are still empty. The next record will tell us whether Vellichor learned the difference or kept the surface.

Vellichor is in lineage. He is also, in places, in costume. The first is durable. The second is what the next record has to remove.`,
  },
  {
    id: "three-records-about-refusal",
    title: "Three Records About Refusal",
    publication: "The Quarterly",
    date: "2026-04-12",
    wordCount: 762,
    body: `Three records out this quarter share a pattern that is worth naming.

The Ferr Trio's "Year of Cold Stove" refuses melody. Avery Lestrange's "Wide Door, Empty Hall" refuses progress. B-Mild's "the broker's lockup" (lowercase) refuses celebration. They are not the same record. They share a structural decision about what to leave out, and what the structural decision means for the form.

I want to read them together.

A refusal is a structural choice that the form expects of the record. The expectation matters; without it, the refusal does not register. A jazz record without melody is, to a listener who does not know jazz expects melody, just a jazz record. The refusal is invisible. To the listener who knows, the refusal is the entire record. The Ferr Trio is, on "Year of Cold Stove," counting on the listener knowing.

What the Ferr Trio is doing instead of melody is interval-work. The melodic line, as a continuous shape across bars, is gone. What remains is intervals between specific notes, treated as discrete objects. The record is, in effect, a record of intervals. The piano plays the major sixth at minute three of track two, and the bass plays the minor third under it, and the question the record asks is what those two intervals together feel like when no melodic line is moving between them. The trio has not previously made this record. Their previous records were about ensemble. "Year of Cold Stove" is about the listener's ear, which is a different argument.

Avery Lestrange's "Wide Door, Empty Hall" refuses progress in a different way. The folk record, structurally, is built on progression — the verse builds, the chorus arrives, the bridge reorients, the final verse takes the journey back to the start with the new information the chorus and the bridge supplied. Lestrange refuses all of it. Each of the ten tracks holds, structurally, where it started. The opening verse is also the closing verse. The chord progression does not move; it sustains, with small variations of timbre, for the entire track. The listener who is waiting for the song to go somewhere will be disappointed. The listener who has accepted that the song is not going anywhere will be doing the work the record is asking of them.

B-Mild's "the broker's lockup" refuses celebration. This is the easiest of the three refusals to describe and the hardest to bring off. The hip-hop record, particularly in the lineage B-Mild is working in, is structurally celebratory — the brag, the boast, the won-against-odds narrative. B-Mild has the won-against-odds material. He simply refuses to celebrate it. The verses sit at minor key, slowly, fragments instead of full sentences, no triumphant turn. The record is a won-against-odds record that refuses to be the record about winning. It is the record about what winning failed to give you.

The three records together make an argument I want to name. The argument is that refusing what the form expects is not the same as refusing the form. The Ferr Trio is still making a jazz record. Lestrange is still making a folk record. B-Mild is still making a hip-hop record. They have stayed inside the form they are working in. They have just decided which part of the form to refuse.

What they share is the discipline of leaving things out. The discipline does not produce three records that sound alike. The records sound like three completely different records. What is alike is the structural decision that holds across all three, and that decision is the thing I have been writing about.

There is a kind of critical reading that wants the refusal to be a movement. It is not a movement. Three records do not make a movement. They make three records that happen to share a structural decision. That is what they make.`,
  },
];

function MarcellusBibliography() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section
      className="mt-8 poa-playground overflow-hidden border"
      style={{ borderColor: "var(--poa-rule)" }}
    >
      <header
        className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-4 py-3"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        <p className="poa-stamp">Bibliography · {REVIEWS.length} published reviews</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
          all readable in full · click a title to expand
        </p>
      </header>
      <ul>
        {REVIEWS.map((r, i) => {
          const isOpen = open === r.id;
          const reviewHash = simulateHash(
            "marcellus:review:" + r.id + ":" + r.title,
          );
          return (
            <li
              key={r.id}
              className="border-b last:border-b-0"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.id)}
                className="block w-full text-left px-4 py-3 transition-colors hover:bg-[color:var(--poa-rule)]/20"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                      #{i + 1} · {r.publication} · {r.wordCount.toLocaleString()} words
                    </p>
                    <h3 className="mt-1 font-serif text-[16px] leading-snug text-[var(--poa-ink)]">
                      {r.title}
                    </h3>
                  </div>
                  <span className="font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
                    {r.date}
                  </span>
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-5">
                  <div className="space-y-3 font-serif text-[14px] leading-[1.75] text-[var(--poa-ink)]">
                    {r.body.split("\n\n").map((para, j) => (
                      <p key={j}>{para}</p>
                    ))}
                  </div>
                  <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                    🔏 signed by Marcellus · published in {r.publication} ·{" "}
                    <span className="break-all normal-case tracking-normal">
                      {shortHash(reviewHash)}
                    </span>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
