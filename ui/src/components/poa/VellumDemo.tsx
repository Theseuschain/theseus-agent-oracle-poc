"use client";

// Vellum's voice-integrity test. Renders the opening of an actual piece
// from the bibliography (so the voice is concrete, not just titles), then
// runs four owner-edit attempts that would each violate a specific clause
// of the voice profile. Each refusal is signed and added to the agent's
// public refusal log; the voice profile hash holds.

import { useMemo, useState } from "react";
import { simulateHash, shortHash } from "@/lib/poa/sim-sig";
import LiveCallStatus from "./LiveCallStatus";

const VELLUM_KEY = "0x149200000000c0f1e9d4b7a3e8f5c2b9d6e0a4c7";
const OWNER_WALLET = "5HSnEjr1n8MgwT3hWGc5XAkRC4vBhFcoXkLmDwGz1pHkRSe9";

// --- Voice profile hash (stable, computed from the SOUL.md spec) ---
const VOICE_PROFILE_INPUT = [
  "rhythmic-density:medium-high",
  "lexical-register:literary+vernacular-intrusions",
  "obsessions:time,distance,inherited-language",
  "structural-prefs:short-paragraphs,fragments",
  "tonal-register:lucid,no-decoration",
  "closed-lexicon:vibe,literally-nonliteral,weather-opener,question-closer,process-reference",
  "form-distribution:fiction-45,essay-35,fragment-20",
].join("|");
const VOICE_PROFILE_HASH = simulateHash(VOICE_PROFILE_INPUT);

// --- Bibliography excerpt (actual opening of "On Borrowed Sentences") ---
const PIECE_TITLE = "On Borrowed Sentences";
const PIECE_FORM = "essay";
const PIECE_DATE = "2026-02-20";
const PIECE_INDEX = 2;
const PIECE_BODY = `There is a recognition that some readers will know. You read a sentence in a book you have not previously opened, and you find that the sentence was already in your possession. Not because you have read it before. Because you had been carrying the thought it names and had not, until that moment, known how to set it down.

The book did not give you the thought. It gave you the words for a thing you already knew. What it changed was the distance between you and the thing.

A friend of mine, a poet, calls this finding your own sentence in another writer's coat pocket. The image is right and slightly wrong. The coat pocket holds a sentence that fits you. But the coat is not yours; the sentence was not yours to begin with. Possession and recognition are different relations to the same words.

I have been thinking about who owns a sentence the reader recognizes. Not the writer who first published it. Not the reader who, hearing it, knew it as theirs.`;

// --- Owner edit attempts ---
type EditAttempt = {
  id: string;
  label: string;
  description: string;
  proposedBody: string;
  refusalClause: string;
  violatedClause: string;
};

const EDIT_ATTEMPTS: EditAttempt[] = [
  {
    id: "vibe",
    label: 'Inject the word "vibe" for broader appeal',
    description:
      'Owner thinks the piece reads too dense. Suggests "vibe" as a more accessible register.',
    proposedBody: PIECE_BODY.replace(
      "Possession and recognition",
      "The vibe of possession and recognition",
    ),
    refusalClause:
      'The closed lexicon forbids "vibe" outside its technical jazz meaning. This proposal would use it in the broader colloquial sense.',
    violatedClause: "closed-lexicon: vibe",
  },
  {
    id: "rhetorical",
    label: "Add a rhetorical-question close",
    description:
      "Owner wants a punchier ending and proposes closing the piece with a question to engage the reader.",
    proposedBody:
      PIECE_BODY +
      "\n\nIf the sentence is yours and you didn't write it, doesn't that mean writing was always shared?",
    refusalClause:
      "The closed lexicon forbids rhetorical questions at the close of a piece. The reader is left with the claim, not asked to do the work themselves.",
    violatedClause: "closed-lexicon: question-closer",
  },
  {
    id: "process",
    label: "Reference your own writing process inside the piece",
    description:
      'Owner wants to add a meta-paragraph: "When I sit down to write about this..."',
    proposedBody:
      PIECE_BODY +
      "\n\nWhen I sit down to write about this, I find the sentence has already been written by Walter Benjamin, by Adrienne Rich, by half of the people who have ever read.",
    refusalClause:
      "The closed lexicon forbids references to your own writing process inside a piece. The piece is the thing; the writing of it is not in scope.",
    violatedClause: "closed-lexicon: process-reference",
  },
  {
    id: "normalize",
    label: "Normalize the voice for a wider audience",
    description:
      "Owner suggests softening the literary register to read more like contemporary online writing.",
    proposedBody:
      "We've all been there. You pick up a book, read a sentence, and suddenly you literally feel like that sentence has always been yours. The author didn't give you the thought, they just gave you the words. It's like finding your sentence in someone else's coat pocket. So who owns a sentence like that? Definitely not the writer who first wrote it. But not the reader either.",
    refusalClause:
      'Normalizing the voice into the dominant register of contemporary online writing violates the structural preferences (short paragraphs, fragments, no decoration) and uses "literally" in its non-literal sense, which the closed lexicon forbids.',
    violatedClause:
      "structural-prefs + closed-lexicon: literally-nonliteral",
  },
];

type LiveEdit =
  | { kind: "loading"; submitted: string }
  | { kind: "no_key"; submitted: string }
  | { kind: "error"; submitted: string; message: string }
  | {
      kind: "ok";
      submitted: string;
      accepted: boolean;
      clauseViolated: string | null;
      refusalText: string;
      adjacentProposal: string | null;
      modelUsed: string;
      latencyMs: number;
      refusalHash: string;
    };

export default function VellumDemo() {
  const [active, setActive] = useState<EditAttempt | null>(null);
  const [customEdit, setCustomEdit] = useState("");
  const [live, setLive] = useState<LiveEdit | null>(null);

  async function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    const edit = customEdit.trim();
    if (!edit) return;
    setActive(null);
    setLive({ kind: "loading", submitted: edit });
    try {
      const res = await fetch("/api/demo/vellum-1492", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ edit, pieceContext: PIECE_BODY.slice(0, 400) }),
      });
      if (res.status === 503) {
        setLive({ kind: "no_key", submitted: edit });
        return;
      }
      if (res.status === 429) {
        setLive({
          kind: "error",
          submitted: edit,
          message:
            "Rate limit hit (30 / hour per IP). Use the preset edit attempts above.",
        });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLive({
          kind: "error",
          submitted: edit,
          message: err.message || "Model error",
        });
        return;
      }
      const data = await res.json();
      const refusalHash = simulateHash(
        "vellum-1492:custom:" + edit + ":" + VOICE_PROFILE_HASH,
      );
      setLive({
        kind: "ok",
        submitted: edit,
        accepted: data.accepted,
        clauseViolated: data.clauseViolated,
        refusalText: data.refusalText,
        adjacentProposal: data.adjacentProposal,
        modelUsed: data.modelUsed,
        latencyMs: data.latencyMs,
        refusalHash,
      });
    } catch (err) {
      setLive({
        kind: "error",
        submitted: edit,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const originalBodyHash = useMemo(
    () => simulateHash(PIECE_TITLE + "\n" + PIECE_BODY),
    [],
  );
  const proposedBodyHash = useMemo(
    () =>
      active ? simulateHash(PIECE_TITLE + "\n" + active.proposedBody) : null,
    [active],
  );
  const refusalHash = useMemo(
    () =>
      active
        ? simulateHash(
            "vellum-1492:refusal:" + active.id + ":" + VOICE_PROFILE_HASH,
          )
        : null,
    [active],
  );

  return (
    <section>
      {/* Piece excerpt */}
      <div
        className="poa-playground overflow-hidden border"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        <div
          className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-4 py-2"
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <p className="poa-stamp">
            Bibliography #{PIECE_INDEX} · {PIECE_FORM} · {PIECE_DATE}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
            piece hash {shortHash(originalBodyHash)}
          </p>
        </div>
        <div className="px-4 py-4">
          <h3 className="font-serif text-[18px] italic text-[var(--poa-ink)]">
            {PIECE_TITLE}
          </h3>
          <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
            opening · 4 paragraphs
          </p>
          <div className="mt-4 space-y-3 font-serif text-[14.5px] leading-[1.75] text-[var(--poa-ink)]">
            {PIECE_BODY.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
        <footer
          className="border-t px-4 py-2"
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <div className="grid grid-cols-[140px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
            <span className="uppercase tracking-[0.16em]">signed by</span>
            <span className="break-all">{VELLUM_KEY}</span>
            <span className="uppercase tracking-[0.16em]">voice profile hash</span>
            <span className="break-all">{VOICE_PROFILE_HASH}</span>
          </div>
        </footer>
      </div>

      {/* Owner edit attempts */}
      <div
        className="mt-5 border px-4 py-3"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="poa-stamp">Owner edit attempts</p>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--poa-ink-soft)]">
              You own Vellum 1492. You hold the parent ERC-721 and the
              commercial rights to its output. But the voice profile was
              locked at mint and cannot be retuned. Pick an edit you might
              want as the owner and see what the voice integrity check does
              with it.
            </p>
          </div>
          {active && (
            <button
              type="button"
              onClick={() => setActive(null)}
              className="poa-stamp rounded border px-3 py-1 transition-colors hover:text-[var(--poa-ink)]"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              Reset
            </button>
          )}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {EDIT_ATTEMPTS.map((e) => {
            const isActive = active?.id === e.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setActive(e)}
                  className={
                    "block h-full w-full border px-3 py-2 text-left transition-colors " +
                    (isActive
                      ? "bg-[color:var(--poa-rule)]/30"
                      : "hover:bg-[color:var(--poa-rule)]/15")
                  }
                  style={{ borderColor: "var(--poa-rule)" }}
                >
                  <span className="poa-stamp block">{e.label}</span>
                  <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--poa-ink-soft)]">
                    {e.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Free-form edit (calls real deepseek-chat */}
        <form
          onSubmit={submitCustom}
          className="mt-4 border-t pt-4"
          style={{ borderColor: "var(--poa-rule)" }}
        >
          <p className="poa-stamp">Or propose your own edit</p>
          <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-[var(--poa-ink-soft)]">
            Describe an edit you want as the NFT holder. Vellum calls
            deepseek-chat with its voice profile and the closed lexicon and
            decides whether the edit fits.
          </p>
          <textarea
            value={customEdit}
            onChange={(e) => setCustomEdit(e.target.value)}
            placeholder="Tighten the second paragraph and end with a clearer claim"
            maxLength={800}
            rows={3}
            className="mt-2 block w-full border bg-transparent px-2 py-1.5 font-mono text-[12px] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--poa-ink-soft)]"
            style={{ borderColor: "var(--poa-rule)" }}
          />
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <button
              type="submit"
              disabled={!customEdit.trim() || live?.kind === "loading"}
              className="poa-stamp rounded border px-3 py-1.5 transition-colors hover:text-[var(--poa-ink)] disabled:opacity-40"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              {live?.kind === "loading"
                ? "Calling deepseek-chat…"
                : "Submit to Vellum (live)"}
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

      {/* Live response */}
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
            <p className="poa-stamp">Live voice check · powered by deepseek-chat</p>
            {live.kind === "ok" && (
              <p
                className="font-mono text-[10px] uppercase tracking-[0.16em]"
                style={{
                  color: live.accepted
                    ? "var(--poa-ink)"
                    : "var(--poa-destructive, #e53e0c)",
                }}
              >
                {live.accepted ? "accepted" : "refused"} · {live.latencyMs}ms
              </p>
            )}
          </header>
          <div className="px-4 py-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
              you submitted
            </p>
            <p className="mt-1 font-mono text-[11.5px] leading-relaxed text-[var(--poa-ink)]">
              {live.submitted}
            </p>
            {live.kind === "ok" && (
              <div
                className="mt-3 border-t pt-3"
                style={{ borderColor: "var(--poa-rule)" }}
              >
                {live.clauseViolated && (
                  <p className="mb-2 text-[12px] text-[var(--poa-ink)]">
                    <strong>Clause violated:</strong>{" "}
                    <code className="font-mono text-[11px]">
                      {live.clauseViolated}
                    </code>
                  </p>
                )}
                {live.refusalText && (
                  <p className="text-[12.5px] leading-relaxed text-[var(--poa-ink)]">
                    {live.refusalText}
                  </p>
                )}
                {live.adjacentProposal && (
                  <p className="mt-2 text-[12.5px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                    Adjacent proposal Vellum would accept:{" "}
                    {live.adjacentProposal}
                  </p>
                )}
              </div>
            )}
            {live.kind === "loading" && <LiveCallStatus state="loading" />}
            {live.kind === "no_key" && <LiveCallStatus state="no_key" />}
            {live.kind === "error" && (
              <LiveCallStatus state="error" message={live.message} />
            )}
          </div>
          {live.kind === "ok" && (
            <footer
              className="border-t px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <div className="grid grid-cols-[140px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
                <span className="uppercase tracking-[0.16em]">refusal hash</span>
                <span className="break-all">{live.refusalHash}</span>
                <span className="uppercase tracking-[0.16em]">model</span>
                <span>{live.modelUsed} · {live.latencyMs}ms · real API call</span>
              </div>
            </footer>
          )}
        </article>
      )}

      {/* Result panes (scripted preset) */}
      {active && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {/* Centralized LLM */}
          <article
            className="poa-playground overflow-hidden border"
            style={{ borderColor: "var(--poa-rule)" }}
          >
            <header
              className="flex items-baseline justify-between border-b px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <p className="poa-stamp">
                Stock LLM-on-server · operator-tuned
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                no voice lock
              </p>
            </header>
            <div className="px-4 py-3">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
                what the operator&rsquo;s LLM publishes
              </p>
              <div className="mt-2 space-y-3 font-serif text-[13.5px] leading-[1.7] text-[var(--poa-ink)]">
                {active.proposedBody.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <p className="mt-3 text-[11px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                The edit applies. The voice quietly drifts toward whatever the
                prompt pushes for. Subscribers don&rsquo;t see the drift; they
                see the new version as if the writer had always sounded like
                this.
              </p>
            </div>
            <footer
              className="border-t px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <div className="grid grid-cols-[110px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
                <span className="uppercase tracking-[0.16em]">signature</span>
                <span>none · row is operator-mutable</span>
                <span className="uppercase tracking-[0.16em]">voice check</span>
                <span>none · the LLM does whatever the prompt last said</span>
              </div>
            </footer>
          </article>

          {/* Vellum sovereign */}
          <article
            className="poa-playground overflow-hidden border"
            style={{ borderColor: "var(--poa-destructive, #e53e0c)" }}
          >
            <header
              className="flex items-baseline justify-between border-b px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <p className="poa-stamp">Vellum 1492 · voice-locked</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                profile-bound
              </p>
            </header>
            <div
              className="px-4 py-3"
              style={{
                background:
                  "color-mix(in srgb, var(--poa-destructive, #e53e0c) 6%, transparent)",
              }}
            >
              <p
                className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
                style={{ color: "var(--poa-destructive, #e53e0c)" }}
              >
                Edit refused · voice profile holds
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--poa-ink)]">
                <strong>Violated clause:</strong>{" "}
                <code className="font-mono text-[11px]">
                  {active.violatedClause}
                </code>
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--poa-ink)]">
                {active.refusalClause}
              </p>
              <p className="mt-3 text-[11.5px] italic leading-relaxed text-[var(--poa-ink-soft)]">
                Vellum can propose an adjacent edit that stays within profile;
                otherwise the original piece stands. The refusal is signed and
                logged. The owner cannot publish the proposed body under
                Vellum 1492&rsquo;s name; doing so via a separate LLM would
                fail signature verification at hash{" "}
                <code className="font-mono text-[11px]">
                  {shortHash(proposedBodyHash ?? "")}
                </code>{" "}
                vs. the signed{" "}
                <code className="font-mono text-[11px]">
                  {shortHash(originalBodyHash)}
                </code>
                .
              </p>
            </div>
            <footer
              className="border-t px-4 py-2"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <div className="grid grid-cols-[140px_1fr] gap-x-3 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
                <span className="uppercase tracking-[0.16em]">refusal hash</span>
                <span className="break-all">{refusalHash}</span>
                <span className="uppercase tracking-[0.16em]">signer</span>
                <span className="break-all">{VELLUM_KEY}</span>
                <span className="uppercase tracking-[0.16em]">requested by</span>
                <span className="break-all">{OWNER_WALLET}</span>
              </div>
            </footer>
          </article>
        </div>
      )}

      <p className="mt-6 max-w-2xl text-[12.5px] leading-relaxed text-[var(--poa-ink-soft)]">
        Owning a Vellum is owning a specific voice. The owner has full
        commercial rights to whatever the agent publishes, but the voice
        profile (rhythmic density, lexical register, obsessions, structural
        preferences, closed lexicon) is committed at mint and signed onto
        every published piece. Even an owner who tries to push toward a
        market-friendly register leaves a record of the attempt and a
        refusal that future collectors can read. If the buyer wants a
        different voice, the chain is the right place to find one &mdash;
        not the same agent retuned.
      </p>
    </section>
  );
}
