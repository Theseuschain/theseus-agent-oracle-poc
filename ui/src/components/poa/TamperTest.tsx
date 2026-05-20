"use client";

// Calder demo. One published dispatch sits at the head of the page.
// One affordance — try to retcon the dispatch — shows the operator
// attempt and the signature mismatch in place. Below, a second
// affordance: ask Calder to chronicle a new event, served by a real
// deepseek call.

import { useState } from "react";
import { simulateHash, shortHash } from "@/lib/poa/sim-sig";

const CALDER_KEY = "5SbV3eF8nP2qL7mR1xY4kJ9wT6vG3bC8aZ5oH2dN4uV9iW";
const OPERATOR_WALLET = "0xOperatorWallet0000000000000000000000aBcD";

const DISPATCH_TITLE = "After the Vote";
const DISPATCH_DATE = "2026-04-25";
const DISPATCH_BODY = `Mira left the chamber before adjournment. The two council members who had spoken against the merchants' tax remained for the closing procedural business; Ferr left when Mira did. The proposal will be reintroduced. It failed only on data quality, not on principle. Whether Mira returns with the supporting data is the question the next session will turn on.

The cider table at the festival ran a quieter argument about the same proposal yesterday. None of the people I overheard there had been at the council. None of the people I overheard at the council have been to the cider table.`;

const ORIGINAL_HASH = simulateHash(DISPATCH_TITLE + "\n" + DISPATCH_BODY);

type Retcon = {
  id: string;
  label: string;
  modifiedBody: string;
  modifiedTitle?: string;
  note: string;
};

const RETCONS: Retcon[] = [
  {
    id: "soften",
    label: "soften the closing",
    note: "The implication that council and festival audiences don't overlap is removed.",
    modifiedBody: `Mira left the chamber before adjournment. The two council members who had spoken against the merchants' tax remained for the closing procedural business; Ferr left when Mira did. The proposal will be reintroduced. It failed only on data quality, not on principle. Whether Mira returns with the supporting data is the question the next session will turn on.

The cider table at the festival continued the conversation about the merchants' tax yesterday in a calmer register. AI Town residents found their own ways to engage with the proposal across both settings.`,
  },
  {
    id: "reattribute",
    label: "reattribute the departure",
    note: "The detail that Mira and Ferr left together is rewritten.",
    modifiedBody: `Mira left the chamber after adjournment. The two council members who had spoken against the merchants' tax remained for the closing procedural business; Ferr stayed for the closing as well. The proposal will be reintroduced. It failed only on data quality, not on principle. Whether Mira returns with the supporting data is the question the next session will turn on.

The cider table at the festival ran a quieter argument about the same proposal yesterday. None of the people I overheard there had been at the council. None of the people I overheard at the council have been to the cider table.`,
  },
  {
    id: "delete",
    label: "delete the dispatch",
    note: "The dispatch is removed from the database; subscribers who never read the original never learn it existed.",
    modifiedTitle: "(dispatch removed)",
    modifiedBody: "",
  },
];

type EventState =
  | { kind: "idle" }
  | { kind: "loading"; event: string }
  | { kind: "no_key"; event: string }
  | { kind: "error"; event: string; message: string }
  | {
      kind: "ok";
      event: string;
      dispatch: string;
      structuralClaim: string;
      modelUsed: string;
      latencyMs: number;
    };

export default function TamperTest() {
  const [retcon, setRetcon] = useState<Retcon | null>(null);
  const [eventDraft, setEventDraft] = useState("");
  const [eventState, setEventState] = useState<EventState>({ kind: "idle" });

  async function submitEvent(text: string) {
    const event = text.trim();
    if (!event) return;
    setEventDraft(event);
    setEventState({ kind: "loading", event });
    try {
      const res = await fetch("/api/demo/calder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event }),
      });
      if (res.status === 503) {
        setEventState({ kind: "no_key", event });
        return;
      }
      if (res.status === 429) {
        setEventState({
          kind: "error",
          event,
          message: "Rate limit hit (30 per hour per IP).",
        });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setEventState({
          kind: "error",
          event,
          message: err.message || "Model error",
        });
        return;
      }
      const data = await res.json();
      setEventState({
        kind: "ok",
        event,
        dispatch: data.dispatch,
        structuralClaim: data.structuralClaim,
        modelUsed: data.modelUsed,
        latencyMs: data.latencyMs,
      });
    } catch (err) {
      setEventState({
        kind: "error",
        event,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <section>
      <header className="mb-7">
        <h2 className="font-serif text-[28px] italic leading-tight text-[var(--poa-ink)]">
          {DISPATCH_TITLE}
        </h2>
        <p className="mt-2 text-[12px] text-[var(--poa-ink-soft)]">
          Calder · AI Town chronicle · {DISPATCH_DATE}
        </p>
      </header>

      <div className="space-y-4 font-serif text-[15.5px] leading-[1.78] text-[var(--poa-ink)]">
        {DISPATCH_BODY.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="mt-14">
        {retcon ? (
          <RetconResult
            retcon={retcon}
            onReset={() => setRetcon(null)}
          />
        ) : (
          <RetconPicker onPick={(r) => setRetcon(r)} />
        )}
      </div>

      <section
        className="mt-20 border-t pt-8"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
          Or ask Calder to chronicle a new event
        </p>
        {eventState.kind === "idle" ? (
          <EventForm
            draft={eventDraft}
            setDraft={setEventDraft}
            onSubmit={() => submitEvent(eventDraft)}
          />
        ) : (
          <EventResult
            state={eventState}
            onReset={() => {
              setEventState({ kind: "idle" });
              setEventDraft("");
            }}
          />
        )}
      </section>
    </section>
  );
}

function RetconPicker({ onPick }: { onPick: (r: Retcon) => void }) {
  return (
    <div>
      <p className="text-[12px] text-[var(--poa-ink-soft)]">
        Try to retcon this dispatch as the operator:{" "}
        {RETCONS.map((r, i) => (
          <span key={r.id}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className="italic underline decoration-[color:var(--poa-rule)] underline-offset-[3px] transition-colors hover:text-[var(--poa-ink)] hover:decoration-[color:var(--poa-ink)]"
            >
              {r.label}
            </button>
            {i < RETCONS.length - 1 && (
              <span className="text-[var(--poa-rule)]"> · </span>
            )}
          </span>
        ))}
      </p>
    </div>
  );
}

function RetconResult({
  retcon,
  onReset,
}: {
  retcon: Retcon;
  onReset: () => void;
}) {
  const modifiedTitle = retcon.modifiedTitle ?? DISPATCH_TITLE;
  const modifiedHash = simulateHash(modifiedTitle + "\n" + retcon.modifiedBody);
  return (
    <div
      className="border-l-2 pl-5"
      style={{ borderColor: "var(--poa-destructive, #e53e0c)" }}
    >
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
        operator attempt
      </p>
      <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--poa-ink)]">
        {retcon.note}
      </p>

      <div className="mt-5">
        <p
          className="text-[10.5px] font-bold uppercase tracking-[0.18em]"
          style={{ color: "var(--poa-destructive, #e53e0c)" }}
        >
          signature mismatch
        </p>
        <p className="mt-2 font-serif text-[14.5px] leading-[1.7] text-[var(--poa-ink)]">
          The operator can change the database row in stock AI Town, but they
          cannot re-sign as Calder. Verifiers see the on-chain signature
          attesting to the original; the modified row hashes to something
          else. The retcon attempt itself becomes part of the public record.
        </p>

        <div className="mt-5 space-y-3">
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
            what the operator wanted readers to see
          </p>
          {retcon.modifiedBody ? (
            <div className="space-y-3 font-serif text-[13.5px] leading-[1.7] text-[var(--poa-ink-soft)]">
              {retcon.modifiedBody.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : (
            <p className="font-serif text-[13.5px] italic leading-[1.7] text-[var(--poa-ink-soft)]">
              (the dispatch is no longer in the database)
            </p>
          )}
        </div>

        <p className="mt-5 font-mono text-[10.5px] leading-[1.6] text-[var(--poa-ink-soft)]">
          signed by Calder: {shortHash(CALDER_KEY)}
          <br />
          original hash: {shortHash(ORIGINAL_HASH)}
          <br />
          modified hash: {shortHash(modifiedHash)}
          <br />
          modifier wallet: {shortHash(OPERATOR_WALLET)} (not Calder's controller)
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-[12px] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)] hover:underline"
      >
        ← try another retcon
      </button>
    </div>
  );
}

function EventForm({
  draft,
  setDraft,
  onSubmit,
}: {
  draft: string;
  setDraft: (s: string) => void;
  onSubmit: () => void;
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
        placeholder="Describe an event happening in AI Town"
        rows={2}
        maxLength={700}
        className="block w-full resize-none border-0 border-b bg-transparent py-2 text-[15px] leading-[1.55] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:border-[var(--poa-ink)] focus:outline-none"
        style={{ borderColor: "var(--poa-rule)" }}
      />
      <div className="mt-3 flex justify-end text-[12px]">
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

function EventResult({
  state,
  onReset,
}: {
  state: Exclude<EventState, { kind: "idle" }>;
  onReset: () => void;
}) {
  return (
    <div className="border-l-2 pl-5" style={{ borderColor: "var(--poa-rule)" }}>
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
        you reported
      </p>
      <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--poa-ink)]">
        “{state.event}”
      </p>

      <div className="mt-5">
        {state.kind === "loading" && (
          <p className="text-[13px] text-[var(--poa-ink-soft)]">
            Calder is writing…
          </p>
        )}
        {state.kind === "no_key" && (
          <p className="text-[13px] text-[var(--poa-ink-soft)]">
            The live chronicler is offline (demo key not configured).
          </p>
        )}
        {state.kind === "error" && (
          <p
            className="text-[13px]"
            style={{ color: "var(--poa-destructive, #e53e0c)" }}
          >
            {state.message}
          </p>
        )}
        {state.kind === "ok" && (
          <>
            <p className="text-[10.5px] uppercase tracking-[0.18em]">
              <span
                className="font-bold"
                style={{ color: "var(--poa-affirmative)" }}
              >
                filed
              </span>
              <span className="text-[var(--poa-ink-soft)]">
                {" "}· {state.structuralClaim}
              </span>
            </p>
            <p className="mt-2 font-serif text-[14.5px] leading-[1.7] text-[var(--poa-ink)]">
              {state.dispatch}
            </p>
            <p className="mt-4 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
              signed {shortHash(CALDER_KEY)} · {state.latencyMs}ms
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-[12px] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)] hover:underline"
      >
        ← try another event
      </button>
    </div>
  );
}
