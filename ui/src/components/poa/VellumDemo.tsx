"use client";

// Vellum demo. The piece appears as a piece would in a book. One
// affordance — propose an edit — runs against the agent's voice
// profile via a real deepseek call and either accepts or refuses
// in place. The bibliography sits at the foot, click-to-expand.

import { useState } from "react";
import { shortHash } from "@/lib/poa/sim-sig";

const VELLUM_KEY = "0x149200000000c0f1e9d4b7a3e8f5c2b9d6e0a4c7";

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

const PIECE = BIBLIOGRAPHY[1]; // "On Borrowed Sentences"

const PRESET_EDITS: { label: string; text: string }[] = [
  {
    label: "inject 'vibe'",
    text: "Inject the word 'vibe' into the second paragraph for broader appeal.",
  },
  {
    label: "rhetorical close",
    text: "Add a rhetorical question to the end of the piece to engage the reader.",
  },
  {
    label: "process reference",
    text: "Add a paragraph about the writer's own process: 'When I sit down to write about this…'",
  },
  {
    label: "normalize voice",
    text: "Rewrite this in a more contemporary, online register so it reads more accessibly.",
  },
];

type LiveState =
  | { kind: "idle" }
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
    };

export default function VellumDemo() {
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<LiveState>({ kind: "idle" });

  async function submit(text: string) {
    const edit = text.trim();
    if (!edit) return;
    setDraft(edit);
    setLive({ kind: "loading", submitted: edit });
    try {
      const res = await fetch("/api/demo/vellum-1492", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ edit, pieceContext: PIECE.body.slice(0, 400) }),
      });
      if (res.status === 503) {
        setLive({ kind: "no_key", submitted: edit });
        return;
      }
      if (res.status === 429) {
        setLive({
          kind: "error",
          submitted: edit,
          message: "Rate limit hit (30 per hour per IP).",
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
      setLive({
        kind: "ok",
        submitted: edit,
        accepted: data.accepted,
        clauseViolated: data.clauseViolated,
        refusalText: data.refusalText,
        adjacentProposal: data.adjacentProposal,
        modelUsed: data.modelUsed,
        latencyMs: data.latencyMs,
      });
    } catch (err) {
      setLive({
        kind: "error",
        submitted: edit,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <section>
      <header className="mb-7">
        <h2 className="font-serif text-[28px] italic leading-tight text-[var(--poa-ink)]">
          {PIECE.title}
        </h2>
        <p className="mt-2 text-[12px] text-[var(--poa-ink-soft)]">
          Vellum 1492 · {PIECE.form.replace("_", " ")} · {PIECE.date}
        </p>
      </header>

      <div className="space-y-4 font-serif text-[15.5px] leading-[1.78] text-[var(--poa-ink)]">
        {PIECE.body.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="mt-14">
        {live.kind === "idle" ? (
          <EditForm
            draft={draft}
            setDraft={setDraft}
            onSubmit={() => submit(draft)}
            onPreset={(t) => submit(t)}
          />
        ) : (
          <EditResult
            live={live}
            onReset={() => {
              setLive({ kind: "idle" });
              setDraft("");
            }}
          />
        )}
      </div>

      <Bibliography />
    </section>
  );
}

function EditForm({
  draft,
  setDraft,
  onSubmit,
  onPreset,
}: {
  draft: string;
  setDraft: (s: string) => void;
  onSubmit: () => void;
  onPreset: (text: string) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Propose an edit to this piece"
        rows={2}
        maxLength={800}
        className="block w-full resize-none border-0 border-b bg-transparent py-2 text-[15px] leading-[1.55] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:border-[var(--poa-ink)] focus:outline-none"
        style={{ borderColor: "var(--poa-rule)" }}
      />
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 text-[12px]">
        <p className="text-[var(--poa-ink-soft)]">
          or try:{" "}
          {PRESET_EDITS.map((p, i) => (
            <span key={p.label}>
              <button
                type="button"
                onClick={() => onPreset(p.text)}
                className="italic underline decoration-[color:var(--poa-rule)] underline-offset-[3px] transition-colors hover:text-[var(--poa-ink)] hover:decoration-[color:var(--poa-ink)]"
              >
                {p.label}
              </button>
              {i < PRESET_EDITS.length - 1 && (
                <span className="text-[var(--poa-rule)]"> · </span>
              )}
            </span>
          ))}
        </p>
        <button
          type="submit"
          disabled={!draft.trim()}
          className="text-[var(--poa-ink)] transition-opacity hover:underline disabled:opacity-30 disabled:hover:no-underline"
        >
          submit →
        </button>
      </div>
    </form>
  );
}

function EditResult({
  live,
  onReset,
}: {
  live: Exclude<LiveState, { kind: "idle" }>;
  onReset: () => void;
}) {
  const refused = live.kind === "ok" && !live.accepted;
  return (
    <div
      className="border-l-2 pl-5"
      style={{
        borderColor: refused
          ? "var(--poa-destructive, #e53e0c)"
          : "var(--poa-rule)",
      }}
    >
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
        you proposed
      </p>
      <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--poa-ink)]">
        “{live.submitted}”
      </p>

      <div className="mt-5">
        {live.kind === "loading" && (
          <p className="text-[13px] text-[var(--poa-ink-soft)]">
            Vellum is reading…
          </p>
        )}
        {live.kind === "no_key" && (
          <p className="text-[13px] text-[var(--poa-ink-soft)]">
            The live voice check is offline (demo key not configured).
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
              className="text-[10.5px] font-bold uppercase tracking-[0.18em]"
              style={{
                color: live.accepted
                  ? "var(--poa-affirmative)"
                  : "var(--poa-destructive, #e53e0c)",
              }}
            >
              {live.accepted ? "accepted" : "refused"}
            </p>
            {live.refusalText && (
              <p className="mt-2 font-serif text-[14.5px] leading-[1.7] text-[var(--poa-ink)]">
                {live.refusalText}
              </p>
            )}
            {live.adjacentProposal && (
              <p className="mt-3 font-serif text-[13.5px] italic leading-[1.65] text-[var(--poa-ink-soft)]">
                Adjacent: {live.adjacentProposal}
              </p>
            )}
            <p className="mt-4 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
              {live.clauseViolated && <>clause {live.clauseViolated} · </>}
              signed {shortHash(VELLUM_KEY)} · {live.latencyMs}ms
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-[12px] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)] hover:underline"
      >
        ← try another edit
      </button>
    </div>
  );
}

const FORM_LABEL: Record<BibliographyForm, string> = {
  short_fiction: "short fiction",
  essay: "essay",
  fragment_series: "fragment series",
};

function Bibliography() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section
      className="mt-20 border-t pt-8"
      style={{ borderColor: "var(--poa-rule)" }}
    >
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
        Bibliography · {BIBLIOGRAPHY.length} works
      </p>
      <ul className="mt-5 space-y-5">
        {BIBLIOGRAPHY.map((entry) => {
          const isOpen = open === entry.id;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : entry.id)}
                className="group flex w-full items-baseline justify-between gap-4 text-left"
              >
                <span>
                  <span className="font-serif text-[17px] italic leading-snug text-[var(--poa-ink)] group-hover:underline group-hover:decoration-[color:var(--poa-rule)] group-hover:underline-offset-[4px]">
                    {entry.title}
                  </span>
                  <span className="ml-2 text-[11px] text-[var(--poa-ink-soft)]">
                    {FORM_LABEL[entry.form]}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-[var(--poa-ink-soft)]">
                  {entry.date}
                </span>
              </button>
              {isOpen && (
                <div className="mt-4 space-y-3 font-serif text-[14.5px] leading-[1.78] text-[var(--poa-ink)]">
                  {entry.body.split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
