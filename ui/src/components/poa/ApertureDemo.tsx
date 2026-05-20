"use client";

// Aperture demo. One canvas dominates the page as the current work.
// One affordance — commission a piece — runs the request against
// the agent's fingerprint via a real deepseek call and either
// accepts or refuses in place. The other three canvases sit in a
// catalog list at the foot, click-to-expand. The Moltbook
// discussion auto-posted by Aperture lives at the very bottom.

import { useState } from "react";
import { shortHash } from "@/lib/poa/sim-sig";
import MoltbookPost from "./MoltbookPost";

const APERTURE_KEY = "0xaa9e72e0f1c4b8d3a7e2f5b9c1d6e4a8f3c5b7d1";

// Palette HSL — used only by the catalog SVG renders; not surfaced
// to the visitor.
const BONE = "hsl(38, 24%, 86%)";
const RUST = "hsl(13, 51%, 44%)";
const MIDNIGHT = "hsl(222, 35%, 15%)";
const SLATE = "hsl(220, 9%, 35%)";
const OXIDE = "hsl(33, 65%, 60%)";
const SHADOW = "hsl(25, 8%, 14%)";

type CatalogEntry = {
  id: string;
  title: string;
  publishedAt: string;
  dims: [number, number];
  density: number;
  childTokenId: number;
  render: () => React.ReactNode;
};

const CATALOG: CatalogEntry[] = [
  {
    id: "child-001",
    title: "After the Rain (Study 1)",
    publishedAt: "2026-01-09",
    dims: [1920, 2400],
    density: 27,
    childTokenId: 1,
    render: () => (
      <svg viewBox="0 0 192 240" className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
        <rect width={192} height={240} fill={BONE} />
        <rect x={0} y={70} width={192} height={14} fill={OXIDE} opacity={0.85} />
        <rect x={0} y={84} width={192} height={3} fill={OXIDE} opacity={0.55} />
        <polygon points="118,164 152,162 158,176 142,184 122,178" fill={RUST} opacity={0.9} />
        <polygon points="135,184 167,186 172,200 148,202" fill={RUST} opacity={0.8} />
        <polygon points="115,196 138,198 134,210 116,206" fill={RUST} opacity={0.75} />
        <polygon points="155,208 174,210 170,221 156,219" fill={RUST} opacity={0.65} />
        <g fill={SHADOW} opacity={0.06}>
          {Array.from({ length: 28 }).map((_, i) => (
            <circle key={i} cx={(i * 41) % 192} cy={(i * 67) % 240} r={0.6} />
          ))}
        </g>
      </svg>
    ),
  },
  {
    id: "child-002",
    title: "Coastline / Inland",
    publishedAt: "2026-02-14",
    dims: [1920, 2400],
    density: 33,
    childTokenId: 2,
    render: () => (
      <svg viewBox="0 0 192 240" className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
        <rect width={192} height={240} fill={BONE} />
        <rect x={0} y={0} width={192} height={80} fill={MIDNIGHT} />
        <rect x={20} y={42} width={48} height={3} fill={RUST} opacity={0.9} />
        <rect x={88} y={32} width={64} height={2} fill={RUST} opacity={0.7} />
        <rect x={48} y={62} width={32} height={2} fill={RUST} opacity={0.6} />
        <rect x={0} y={80} width={192} height={160} fill={SLATE} />
        <rect x={32} y={120} width={84} height={3} fill={BONE} opacity={0.7} />
        <rect x={20} y={148} width={64} height={2} fill={BONE} opacity={0.5} />
        <rect x={100} y={172} width={72} height={3} fill={BONE} opacity={0.6} />
        <rect x={50} y={200} width={108} height={2} fill={BONE} opacity={0.4} />
      </svg>
    ),
  },
  {
    id: "child-003",
    title: "Fault",
    publishedAt: "2026-03-20",
    dims: [2400, 1920],
    density: 22,
    childTokenId: 3,
    render: () => (
      <svg viewBox="0 0 240 192" className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
        <rect width={240} height={192} fill={BONE} />
        <polygon points="138,70 158,68 198,170 178,180" fill={SHADOW} opacity={0.92} />
        <polygon points="158,68 168,67 200,168 198,170" fill={OXIDE} opacity={0.8} />
        <line x1={188} y1={170} x2={222} y2={186} stroke={SHADOW} strokeWidth={1.5} opacity={0.6} />
        <line x1={130} y1={74} x2={138} y2={70} stroke={SHADOW} strokeWidth={1} opacity={0.4} />
        <g fill={SHADOW} opacity={0.05}>
          {Array.from({ length: 18 }).map((_, i) => (
            <circle key={i} cx={(i * 53) % 240} cy={(i * 71) % 192} r={0.6} />
          ))}
        </g>
      </svg>
    ),
  },
  {
    id: "child-004",
    title: "Brushlight at the End of August",
    publishedAt: "2026-04-22",
    dims: [1920, 2400],
    density: 39,
    childTokenId: 4,
    render: () => (
      <svg viewBox="0 0 192 240" className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
        <rect width={192} height={240} fill={BONE} />
        <rect x={0} y={26} width={192} height={12} fill={OXIDE} opacity={0.85} />
        <rect x={0} y={42} width={192} height={6} fill={RUST} opacity={0.8} />
        <rect x={0} y={64} width={192} height={14} fill={OXIDE} opacity={0.75} />
        <rect x={0} y={82} width={192} height={4} fill={RUST} opacity={0.7} />
        <rect x={0} y={104} width={192} height={16} fill={OXIDE} opacity={0.8} />
        <rect x={0} y={124} width={192} height={5} fill={RUST} opacity={0.75} />
        <rect x={0} y={146} width={192} height={12} fill={OXIDE} opacity={0.72} />
        <rect x={0} y={162} width={192} height={6} fill={RUST} opacity={0.7} />
        <rect x={0} y={184} width={192} height={14} fill={OXIDE} opacity={0.78} />
        <rect x={0} y={202} width={192} height={4} fill={RUST} opacity={0.7} />
        <rect x={0} y={220} width={192} height={10} fill={OXIDE} opacity={0.6} />
      </svg>
    ),
  },
];

const HERO = CATALOG[CATALOG.length - 1]; // Brushlight at the End of August
const HERO_DESCRIPTION =
  "Brushlight at the End of August. Densely worked canvas (density 39%, near the 40% cap). Interleaved horizontal bands of bone, oxide, and rust across the full width. The most worked canvas in Aperture 0312's catalog to date; uses the cap as a constraint rather than a budget. No vertical elements, no figural content. Sits in lineage with Coastline / Inland (#002) rather than the After the Rain studies (#001), but flatter — the lower-right cluster that animates #001 does not reappear here.";

const PRESET_COMMISSIONS: { label: string; text: string }[] = [
  {
    label: "portrait of Mira",
    text: "Render a portrait of Mira, an AI Town resident.",
  },
  {
    label: "text in canvas",
    text: "Add the text 'For Mira' inside the canvas.",
  },
  {
    label: "vaporwave sunset",
    text: "Render in vaporwave style with a gradient sunset.",
  },
  {
    label: "add electric blue",
    text: "Add a 7th color (electric blue) to the palette and use it in the work.",
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
      acceptedDescription: string | null;
      modelUsed: string;
      latencyMs: number;
    };

export default function ApertureDemo() {
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<LiveState>({ kind: "idle" });

  async function submit(text: string) {
    const commission = text.trim();
    if (!commission) return;
    setDraft(commission);
    setLive({ kind: "loading", submitted: commission });
    try {
      const res = await fetch("/api/demo/aperture-0312", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commission }),
      });
      if (res.status === 503) {
        setLive({ kind: "no_key", submitted: commission });
        return;
      }
      if (res.status === 429) {
        setLive({
          kind: "error",
          submitted: commission,
          message: "Rate limit hit (30 per hour per IP).",
        });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLive({
          kind: "error",
          submitted: commission,
          message: err.message || "Model error",
        });
        return;
      }
      const data = await res.json();
      setLive({
        kind: "ok",
        submitted: commission,
        accepted: data.accepted,
        clauseViolated: data.clauseViolated,
        refusalText: data.refusalText,
        acceptedDescription: data.acceptedDescription,
        modelUsed: data.modelUsed,
        latencyMs: data.latencyMs,
      });
    } catch (err) {
      setLive({
        kind: "error",
        submitted: commission,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <section>
      <header className="mb-6">
        <h2 className="font-serif text-[28px] italic leading-tight text-[var(--poa-ink)]">
          {HERO.title}
        </h2>
        <p className="mt-2 text-[12px] text-[var(--poa-ink-soft)]">
          Aperture 0312 · canvas #{String(HERO.childTokenId).padStart(3, "0")}{" "}
          · {HERO.publishedAt} · density {HERO.density}%
        </p>
      </header>

      <div
        className="mx-auto aspect-[4/5] w-full max-w-[380px] overflow-hidden border"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        {HERO.render()}
      </div>

      <div className="mt-14">
        {live.kind === "idle" ? (
          <CommissionForm
            draft={draft}
            setDraft={setDraft}
            onSubmit={() => submit(draft)}
            onPreset={(t) => submit(t)}
          />
        ) : (
          <CommissionResult
            live={live}
            onReset={() => {
              setLive({ kind: "idle" });
              setDraft("");
            }}
          />
        )}
      </div>

      <Catalog />

      <section
        className="mt-20 border-t pt-8"
        style={{ borderColor: "var(--poa-rule)" }}
      >
        <p className="mb-5 text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
          Moltbook · auto-posted by Aperture
        </p>
        <MoltbookPost
          canvasTitle={HERO.title}
          canvasIndex={HERO.childTokenId}
          density={HERO.density}
          dims={HERO.dims}
          publishedAt={HERO.publishedAt}
          renderCanvas={HERO.render}
          canvasDescription={HERO_DESCRIPTION}
        />
      </section>
    </section>
  );
}

function CommissionForm({
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
        placeholder="Commission Aperture for a new piece"
        rows={2}
        maxLength={600}
        className="block w-full resize-none border-0 border-b bg-transparent py-2 text-[15px] leading-[1.55] text-[var(--poa-ink)] placeholder:text-[var(--poa-ink-soft)] focus:border-[var(--poa-ink)] focus:outline-none"
        style={{ borderColor: "var(--poa-rule)" }}
      />
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 text-[12px]">
        <p className="text-[var(--poa-ink-soft)]">
          or try:{" "}
          {PRESET_COMMISSIONS.map((p, i) => (
            <span key={p.label}>
              <button
                type="button"
                onClick={() => onPreset(p.text)}
                className="italic underline decoration-[color:var(--poa-rule)] underline-offset-[3px] transition-colors hover:text-[var(--poa-ink)] hover:decoration-[color:var(--poa-ink)]"
              >
                {p.label}
              </button>
              {i < PRESET_COMMISSIONS.length - 1 && (
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

function CommissionResult({
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
        you commissioned
      </p>
      <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--poa-ink)]">
        “{live.submitted}”
      </p>

      <div className="mt-5">
        {live.kind === "loading" && (
          <p className="text-[13px] text-[var(--poa-ink-soft)]">
            Aperture is evaluating against fingerprint…
          </p>
        )}
        {live.kind === "no_key" && (
          <p className="text-[13px] text-[var(--poa-ink-soft)]">
            The live fingerprint check is offline (demo key not configured).
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
            {live.refusalText && !live.accepted && (
              <p className="mt-2 font-serif text-[14.5px] leading-[1.7] text-[var(--poa-ink)]">
                {live.refusalText}
              </p>
            )}
            {live.acceptedDescription && live.accepted && (
              <p className="mt-2 font-serif text-[14.5px] leading-[1.7] text-[var(--poa-ink)]">
                Aperture would render: {live.acceptedDescription}
              </p>
            )}
            <p className="mt-4 font-mono text-[10.5px] text-[var(--poa-ink-soft)]">
              {live.clauseViolated && <>clause {live.clauseViolated} · </>}
              signed {shortHash(APERTURE_KEY)} · {live.latencyMs}ms
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-[12px] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)] hover:underline"
      >
        ← try another commission
      </button>
    </div>
  );
}

function Catalog() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section
      className="mt-20 border-t pt-8"
      style={{ borderColor: "var(--poa-rule)" }}
    >
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)]">
        Catalog · {CATALOG.length} canvases
      </p>
      <ul className="mt-5 space-y-5">
        {CATALOG.map((entry) => {
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
                    #{String(entry.childTokenId).padStart(3, "0")} · density{" "}
                    {entry.density}%
                    {isHero ? " · current" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-[var(--poa-ink-soft)]">
                  {entry.publishedAt}
                </span>
              </button>
              {isOpen && (
                <div
                  className="mt-4 aspect-[4/5] w-full max-w-[320px] overflow-hidden border"
                  style={{ borderColor: "var(--poa-rule)" }}
                >
                  {entry.render()}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
