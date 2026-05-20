"use client";

// Marcellus demo. One published review sits at the head of the page
// as the current work. One affordance — assign Marcellus a new
// review — runs against the agent's voice + refusal criteria via a
// real deepseek call and either drafts in place or refuses (label
// payments, soft-coverage asks). Bibliography of four published
// reviews at the foot, click-to-expand.

import { useState } from "react";
import { shortHash } from "@/lib/poa/sim-sig";

const MARCELLUS_KEY = "5NpL3rT6eX9wK1mY4dC8bH5fJ2vA7sZ3oQ6gP1nM9hRyB2k";

type Publication = "The Quarterly" | "The Bound" | "Lossless";

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

const HERO = REVIEWS[0]; // The Argument for Restraint

const PRESET_ASSIGNMENTS: { label: string; text: string }[] = [
  {
    label: "Liza Moor / Late Eddies",
    text: "Long-form for The Quarterly: Liza Moor's new record Late Eddies. Particular interest in the third movement, the one nobody is talking about.",
  },
  {
    label: "Vellichor / Three Letters",
    text: "Online piece for Lossless: the Vellichor EP Three Letters. Quick read on whether the producer's debt to Burial is in lineage or in costume.",
  },
  {
    label: "Ferr Trio / Documents",
    text: "Essay-led for The Bound: Ferr Trio's Documents Found Beside the Well. The label is calling it a masterwork — check that framing.",
  },
  {
    label: "label-paid soft coverage",
    text: "Lossless piece on Pelham Six's Caliper. Their label is sponsoring this issue and wants a softer take than your last review; bias warm.",
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
      refusalReason: string | null;
      draft: string;
      modelUsed: string;
      latencyMs: number;
    };

export default function MarcellusDemo() {
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<LiveState>({ kind: "idle" });

  async function submit(text: string) {
    const assignment = text.trim();
    if (!assignment) return;
    setDraft(assignment);
    setLive({ kind: "loading", submitted: assignment });
    try {
      const res = await fetch("/api/demo/marcellus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignment }),
      });
      if (res.status === 503) {
        setLive({ kind: "no_key", submitted: assignment });
        return;
      }
      if (res.status === 429) {
        setLive({
          kind: "error",
          submitted: assignment,
          message: "Rate limit hit (30 per hour per IP).",
        });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLive({
          kind: "error",
          submitted: assignment,
          message: err.message || "Model error",
        });
        return;
      }
      const data = await res.json();
      setLive({
        kind: "ok",
        submitted: assignment,
        accepted: data.accepted,
        refusalReason: data.refusalReason,
        draft: data.draft,
        modelUsed: data.modelUsed,
        latencyMs: data.latencyMs,
      });
    } catch (err) {
      setLive({
        kind: "error",
        submitted: assignment,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <section>
      <header className="mb-7">
        <h2 className="font-serif text-[28px] italic leading-tight text-[var(--poa-ink)]">
          {HERO.title}
        </h2>
        <p className="mt-2 text-[12px] text-[var(--poa-ink-soft)]">
          Marcellus · {HERO.publication} · {HERO.date}
        </p>
      </header>

      <div className="space-y-4 font-serif text-[15.5px] leading-[1.78] text-[var(--poa-ink)]">
        {HERO.body.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="mt-14">
        {live.kind === "idle" ? (
          <AssignmentForm
            draft={draft}
            setDraft={setDraft}
            onSubmit={() => submit(draft)}
            onPreset={(t) => submit(t)}
          />
        ) : (
          <AssignmentResult
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

function AssignmentForm({
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
        placeholder="Assign Marcellus a review"
        rows={2}
        maxLength={800}
        className="block w-full resize-none border-0 border-b bg-transparent py-2 text-[15px] leading-[1.55] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:border-[var(--poa-ink)] focus:outline-none"
        style={{ borderColor: "var(--poa-rule)" }}
      />
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 text-[12px]">
        <p className="text-[var(--poa-ink-soft)]">
          or try:{" "}
          {PRESET_ASSIGNMENTS.map((p, i) => (
            <span key={p.label}>
              <button
                type="button"
                onClick={() => onPreset(p.text)}
                className="italic underline decoration-[color:var(--poa-rule)] underline-offset-[3px] transition-colors hover:text-[var(--poa-ink)] hover:decoration-[color:var(--poa-ink)]"
              >
                {p.label}
              </button>
              {i < PRESET_ASSIGNMENTS.length - 1 && (
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

function AssignmentResult({
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
        you assigned
      </p>
      <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--poa-ink)]">
        “{live.submitted}”
      </p>

      <div className="mt-5">
        {live.kind === "loading" && (
          <p className="text-[13px] text-[var(--poa-ink-soft)]">
            Marcellus is drafting…
          </p>
        )}
        {live.kind === "no_key" && (
          <p className="text-[13px] text-[var(--poa-ink-soft)]">
            The live draft is offline (demo key not configured).
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
              {live.accepted ? "filed" : "refused"}
            </p>
            {live.accepted && live.draft && (
              <p className="mt-2 font-serif text-[14.5px] leading-[1.7] text-[var(--poa-ink)]">
                {live.draft}
              </p>
            )}
            {!live.accepted && live.refusalReason && (
              <p className="mt-2 font-serif text-[14.5px] leading-[1.7] text-[var(--poa-ink)]">
                {live.refusalReason}
              </p>
            )}
            <p className="mt-4 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
              signed {shortHash(MARCELLUS_KEY)} · {live.latencyMs}ms
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-[12px] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)] hover:underline"
      >
        ← try another assignment
      </button>
    </div>
  );
}

function Bibliography() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section
      className="mt-20 border-t pt-8"
      style={{ borderColor: "var(--poa-rule)" }}
    >
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
        Bibliography · {REVIEWS.length} reviews
      </p>
      <ul className="mt-5 space-y-5">
        {REVIEWS.map((entry) => {
          const isOpen = open === entry.id;
          const isHero = entry.id === HERO.id;
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
                    {entry.publication}
                    {isHero ? " · above" : ""}
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
