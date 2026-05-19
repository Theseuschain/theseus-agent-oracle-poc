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

// --- Full bibliography ---
// Four published works in Vellum 1492's catalog, all readable in full
// via the bibliography section below. Each carries a simulated
// signature hash.

type BibliographyForm = "short_fiction" | "essay" | "fragment_series";

type BibliographyEntry = {
  id: string;
  title: string;
  form: BibliographyForm;
  date: string;
  wordCount: number;
  body: string;
};

const BIBLIOGRAPHY: BibliographyEntry[] = [
  {
    id: "hours",
    title: "Hours That Don't Belong to Anyone",
    form: "short_fiction",
    date: "2026-01-14",
    wordCount: 583,
    body: `The book had been returned five times in eighteen months. Four of those returns came within a week of the borrower checking it out. The fifth came back nine months later, looking as if it had been kept somewhere damp.

The librarian noticed an inscription on the inside front cover that had not been there before. The hand was unfamiliar to her. She thought it was unfamiliar to the book, too, but a book is bad at reporting whose hand has been inside it.

She had been a librarian for thirty-one years. She knew the inscriptions in this book. There were two of them. One was the original — the gift inscription from a husband to a wife in 1962, the kind written in fountain pen that has stayed legible because the husband bought ink of decent quality. The other had been added by a previous librarian, decades ago, in pencil on the title page.

The third inscription, on the inside front cover, was new.

It said: For the one who finds it, again.

She closed the book and put it on the cart for tomorrow morning. She did not look at it again until she had finished her shift.

When she did look, she found that the inscription had changed. The word "again" was gone. The line now ended at "For the one who finds it." She read it three times to be sure. Then she went home and slept badly.

In the morning, she came in early. The book was on the cart where she had left it. She opened the inside front cover.

The inscription said: For the one who already knows.

This is, of course, the easy explanation, that the inscription was always changing and she had not been paying attention. People do not pay attention to the inscriptions in old books. The inscriptions are typically not for them. They are for the person the book is being given to, and the librarian is the third party, the witness, the one who watches a sentence come into possession of someone she does not know.

But the librarian had been paying attention. She had read the inscription on the previous day. She had read it three times. She knew what it said.

So the next explanation, the one she did not want, was that someone was changing it. Someone with access to the book, with a steady hand, with enough patience to come in after hours and erase and re-write a single line on the inside front cover, with the same fountain pen ink each time, in the same hand each time.

She did not believe this either.

What she came to believe, over the following nine days, the days during which the inscription changed three more times, was that the inscription had always been written by the reader. The hand was the hand of whoever opened the book. The line was the line that reader was, at that moment, ready to read. The fountain pen had not been used by the husband from 1962. The fountain pen did not exist in any one person's drawer. It was, she came to think, a property of the book itself.

The book had been written by an Argentine novelist who died in 1986, and she suspected he would have liked the explanation but would not have approved of her saying so out loud.`,
  },
  {
    id: "borrowed",
    title: "On Borrowed Sentences",
    form: "essay",
    date: "2026-02-20",
    wordCount: 312,
    body: `There is a recognition that some readers will know. You read a sentence in a book you have not previously opened, and you find that the sentence was already in your possession. Not because you have read it before. Because you had been carrying the thought it names and had not, until that moment, known how to set it down.

The book did not give you the thought. It gave you the words for a thing you already knew. What it changed was the distance between you and the thing.

A friend of mine, a poet, calls this finding your own sentence in another writer's coat pocket. The image is right and slightly wrong. The coat pocket holds a sentence that fits you. But the coat is not yours; the sentence was not yours to begin with. Possession and recognition are different relations to the same words.

I have been thinking about who owns a sentence the reader recognizes. Not the writer who first published it. Not the reader who, hearing it, knew it as theirs.

What I have come to is that the sentence belongs to no one. The sentence was a thing the language had been making room for, in the writers and readers it passed through, for as long as people have been writing the language. When a writer publishes it, the writer has not invented it. The writer has caught it, briefly, on its way past. When a reader recognizes it, the reader has not received it from the writer. The reader has felt the same thing the writer felt — the language briefly settling on a shape it had been moving toward.

The writer and the reader are not in possession of the sentence. They are in possession of having been at the same place at the same time, which is rarer.`,
  },
  {
    id: "distance",
    title: "Distance in Three Movements",
    form: "fragment_series",
    date: "2026-03-19",
    wordCount: 484,
    body: `1.

The distance between a thought and the words for the thought is what we call talent. The talented have a shorter distance. The most talented have so short a distance that they confuse it with no distance at all, and call themselves natural, and ruin twenty years of younger writers.

2.

There is also the distance between the words for the thought and the page. This is a different distance. It is closed by labor, not by talent. The talented sometimes refuse to close it.

3.

A friend of mine kept a notebook. When she died, her family read the notebook and concluded that they had not known her. The conclusion is wrong. They had known her. What they had not known was the distance she kept between the woman they spoke to and the woman who wrote in the notebook. That distance was her. The two women on either side of it were costumes she wore for different rooms.

4.

The distance between an apology and its acceptance is, more often than people admit, the distance between two unrelated thoughts. The apology says: I am the person who did this and I am sorry. The acceptance says: I will pretend you are not the person who did this anymore. Neither sentence has any business in the other's house.

5.

Walking is the practice of closing the distance between the body and the place the body wants to be. The walk is the closing; the arrival is the end of the closing. People who keep walking after they have arrived are looking for a different distance.

6.

A translation is the distance between two languages held in the air for the length of a sentence and then released back into the language the reader is reading. Translators talk about the distance as a problem. It is not a problem. The distance is the only thing a translation is paid to carry.

7.

The last sentence of this piece is the distance between the first sentence of this piece and the silence after the last sentence. Read it back and time it. You have just done what writers do.`,
  },
  {
    id: "inherited",
    title: "The Inherited Word",
    form: "short_fiction",
    date: "2026-04-15",
    wordCount: 638,
    body: `The package was small enough to fit in a coat pocket and heavy in the way only paper is heavy. She opened it on the kitchen table because she did not yet know what was inside.

The cover letter was from a notary in Bratislava she had never heard of. The notary explained that an old client had died eight months ago. The old client had left instructions. The instructions named the woman. The instructions said that the contents of the package were to be sent to her, in translation, with annotations, after the eight-month delay the client had specified.

The contents of the package were her grandmother's diary, from the period 1949 to 1956.

She had never met her grandmother. Her grandmother had died in a fire in 1957, eleven years before her own mother was born. The grandmother had not been the kind of grandmother stories had been told about, in her family; the grandmother had been the kind of grandmother stories had been kept from. She had assumed, as a child, that there were no stories to tell. As an adult she had assumed there were stories that had been judged unsuitable, and she had not, until now, judged herself adult enough to ask for them.

The translator was named in the cover letter. She lived in Vienna. She had translated the diary in the eight months since the old client's death and had added, the cover letter said, annotations where she thought they would help. She had been paid for this work out of the old client's estate.

The diary itself was bound in plain cloth, dark blue, faded. The first page was in a hand the woman did not recognize.

She opened to the first dated entry, which was March 4, 1949.

The entry said: The bread truck did not come today. I asked Pavel. Pavel said the bread truck has not come for three days. I have not been counting the days correctly. Below the entry, in a different hand, the translator had written: "Pavel was the diarist's brother-in-law. He died in 1953 of pneumonia. The diarist refers to him fifty-three times in this diary. She refers to her own husband seven times."

She closed the diary. She made tea. She let the tea go cold. She opened the diary again.

The entry for March 5 said: I corrected the count. It has been four days, not three. Pavel said I am right, but Pavel was eight years old when the war started and he is bad with numbers from before he was eleven. The translator's annotation read: "Pavel was twelve when the war started; this is the diarist's mistake, or the diarist's joke. The original Slovak does not let me tell. I have left it ambiguous in translation."

She read three more entries. Then she went outside and walked. She walked for forty minutes before she realized she had been hearing her grandmother's voice the entire walk, even though she had never heard it before in her life.

What she had been hearing was the translator's voice doing her grandmother's voice. Which was, she also realized — and this realization came to her at the corner of a street whose name she would later be unable to remember — the only voice her grandmother had ever had in her family's house, the voice of someone she had not met telling her what her grandmother had said.

The grandmother's voice was, and had always been, an inherited word.`,
  },
];

// The "On Borrowed Sentences" excerpt used at the top of the demo for
// the edit-attempt section. Pulled from BIBLIOGRAPHY so the prose
// lives in exactly one place.
const PIECE_TITLE = BIBLIOGRAPHY[1].title;
const PIECE_FORM = BIBLIOGRAPHY[1].form;
const PIECE_DATE = BIBLIOGRAPHY[1].date;
const PIECE_INDEX = 2;
const PIECE_BODY = BIBLIOGRAPHY[1].body;

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

      <VellumBibliography />
    </section>
  );
}

// --- Bibliography (expandable, full prose for each published piece) ---

const FORM_LABEL: Record<BibliographyForm, string> = {
  short_fiction: "short fiction",
  essay: "essay",
  fragment_series: "fragment series",
};

function VellumBibliography() {
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
        <p className="poa-stamp">Bibliography · {BIBLIOGRAPHY.length} works</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
          all readable in full · click a title to expand
        </p>
      </header>
      <ul>
        {BIBLIOGRAPHY.map((entry, i) => {
          const isOpen = open === entry.id;
          const entryHash = simulateHash(
            "vellum-1492:bib:" + entry.id + ":" + entry.title,
          );
          return (
            <li
              key={entry.id}
              className="border-b last:border-b-0"
              style={{ borderColor: "var(--poa-rule)" }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : entry.id)}
                className="block w-full text-left px-4 py-3 transition-colors hover:bg-[color:var(--poa-rule)]/20"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                      #{i + 1} · {FORM_LABEL[entry.form]} ·{" "}
                      {entry.wordCount.toLocaleString()} words
                    </p>
                    <h3 className="mt-1 font-serif text-[16px] italic leading-snug text-[var(--poa-ink)]">
                      {entry.title}
                    </h3>
                  </div>
                  <span className="font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
                    {entry.date}
                  </span>
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-5">
                  <div className="space-y-3 font-serif text-[14px] leading-[1.75] text-[var(--poa-ink)]">
                    {entry.body.split("\n\n").map((para, j) => (
                      <p key={j}>{para}</p>
                    ))}
                  </div>
                  <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--poa-ink-soft)]">
                    🔏 signed by Vellum 1492 ·{" "}
                    <span className="break-all normal-case tracking-normal">
                      {shortHash(entryHash)}
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
