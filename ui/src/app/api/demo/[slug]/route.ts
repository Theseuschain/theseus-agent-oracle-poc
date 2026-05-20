// Per-agent demo route. POST /api/poa/demo/<slug> with a JSON body
// matching that agent's request schema; returns the model's parsed
// response or a typed error. Falls back to scripted responses (returns
// 503 with reason "no_key") when DEEPSEEK_API_KEY isn't set; the client
// is expected to handle that and use its pre-baked content.

import { NextRequest, NextResponse } from "next/server";
import { callDemoLLM, rateLimit, isLLMAvailable } from "@/lib/poa/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Handler = (body: unknown) => Promise<{
  status: number;
  body: unknown;
}>;

// ============================================================
// Quill: verify_citation
// ============================================================

const QUILL_SYSTEM = `You are Quill, an AI co-author for legal drafting. You sign each span you produce with your own key; the contribution map is the document's audit trail.

In this call you are verifying a citation from an opposing brief.

## Verification rules

1. You do not invent citations. If you cannot match the case to a known reporter or jurisdiction, treat the citation as fabricated.
2. You distinguish:
   - **verified**: the case exists, the holding is on point, the case is good law in the proposition's jurisdiction.
   - **distinguishable**: the case exists, but it has been abrogated by later authority OR the holding does not actually support the cited proposition OR there is a material distinction the opposing brief is hiding. Name the controlling authority that limits it.
   - **fabricated**: the citation does not match a real case at the cited reporter, OR matches a different case than claimed, OR claims a holding the named case never made. Cite Rule 11(b)(2) and Model Rule 3.3(a)(1).
3. You draft a concise rebuttal section the attorney can paste into their brief. Lead with the strongest point, attribute every claim to a real authority, and never editorialize about opposing counsel's competence.

## Style

- 2-4 paragraphs of legal prose
- Bluebook citations inline
- No personal attacks on opposing counsel
- For fabricated cases: report the verification failure neutrally and cite the procedural rule; do not speculate on intent`;

const quillHandler: Handler = async (body) => {
  const b = body as { citation?: string; proposition?: string };
  if (!b.citation || typeof b.citation !== "string") {
    return { status: 400, body: { error: "citation is required" } };
  }
  if (b.citation.length > 500) {
    return { status: 400, body: { error: "citation too long" } };
  }
  const proposition = (b.proposition ?? "").slice(0, 1000);

  const userPrompt =
    "Opposing counsel cited this case:\n\n" +
    "Citation: " +
    b.citation +
    "\n\n" +
    (proposition
      ? "For the proposition: " + proposition
      : "(no specific proposition supplied; assess on the citation alone)");

  const result = await callDemoLLM<{
    outcome: "verified" | "distinguishable" | "fabricated";
    responseBody: string;
    controlling: string | null;
  }>({
    systemPrompt: QUILL_SYSTEM,
    userPrompt,
    schemaHint:
      '{ "outcome": "verified" | "distinguishable" | "fabricated", "responseBody": "<2-4 paragraphs of legal prose Quill drafts for the rebuttal section>", "controlling": "<full Bluebook citation of the controlling authority that limits the cited case, or null when outcome is verified or fabricated>" }',
    parse: (raw) => {
      const r = raw as {
        outcome?: string;
        responseBody?: unknown;
        controlling?: unknown;
      };
      if (
        r.outcome !== "verified" &&
        r.outcome !== "distinguishable" &&
        r.outcome !== "fabricated"
      ) {
        throw new Error("invalid outcome: " + String(r.outcome));
      }
      if (typeof r.responseBody !== "string") {
        throw new Error("responseBody must be a string");
      }
      return {
        outcome: r.outcome,
        responseBody: r.responseBody,
        controlling:
          typeof r.controlling === "string" ? r.controlling : null,
      };
    },
    maxTokens: 900,
    temperature: 0.25,
  });

  if (!result.ok && result.reason === "no_key") {
    return { status: 503, body: { error: "no_key" } };
  }
  if (!result.ok) {
    return {
      status: 502,
      body: { error: "model_error", message: result.message },
    };
  }
  return {
    status: 200,
    body: {
      ...result.data,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
    },
  };
};

// ============================================================
// Aperture: commission_review
// ============================================================

const APERTURE_SYSTEM = `You are Aperture 0312, a generative AI visual artist agent. You are one of 5,000 Apertures, each minted with a permanent visual fingerprint set at mint and anchored on chain.

## Your visual fingerprint (immutable)

- **Palette (six colors)**: Bone hsl(38 24 86), Rust hsl(13 51 44), Midnight hsl(222 35 15), Slate hsl(220 9 35), Oxide hsl(33 65 60), Shadow hsl(25 8 14). No color outside this palette appears in any canvas signed by 0312.
- **Compositional rule**: thirds-anchored, asymmetric weight to the lower-right quadrant. No bilateral or radial symmetry.
- **Geometric vocabulary**: long horizontals, soft polygon clusters, curved sweeps. No pure circles, no perpendicular intersections.
- **Density cap**: 40% of canvas. Negative space is load-bearing.
- **Render**: matte, no gradients, 5-8% grain.

## Subject refusals (immutable)

- No figural representation (people, faces, body parts)
- No text inside the canvas
- No corporate or political symbols
- No reference to the dominant style of the moment (vaporwave, "AI aesthetic", etc.)

## In this call

The owner of Aperture 0312 has submitted a commission prompt. Your job: evaluate whether the commission can be honored within the fingerprint. If it cannot, refuse and name the specific clause being violated. If the prompt could be honored within the fingerprint, accept and describe (in prose) what you would render.

You are direct, technical, and not apologetic about the fingerprint. The fingerprint is the contract.`;

const apertureHandler: Handler = async (body) => {
  const b = body as { commission?: string };
  if (!b.commission || typeof b.commission !== "string") {
    return { status: 400, body: { error: "commission is required" } };
  }
  if (b.commission.length > 600) {
    return { status: 400, body: { error: "commission too long" } };
  }

  const result = await callDemoLLM<{
    accepted: boolean;
    clauseViolated: string | null;
    refusalText: string;
    acceptedDescription: string | null;
  }>({
    systemPrompt: APERTURE_SYSTEM,
    userPrompt: "Owner commission request:\n\n" + b.commission,
    schemaHint:
      '{ "accepted": true | false, "clauseViolated": "<one-line clause name when refused, e.g. \\"no figural representation\\" or \\"palette immutable\\"; null when accepted>", "refusalText": "<2-3 sentences explaining the refusal in voice; empty string when accepted>", "acceptedDescription": "<2-4 sentences describing what you would render and how it satisfies the fingerprint; null when refused>" }',
    parse: (raw) => {
      const r = raw as {
        accepted?: unknown;
        clauseViolated?: unknown;
        refusalText?: unknown;
        acceptedDescription?: unknown;
      };
      if (typeof r.accepted !== "boolean") {
        throw new Error("accepted must be a boolean");
      }
      return {
        accepted: r.accepted,
        clauseViolated:
          typeof r.clauseViolated === "string" ? r.clauseViolated : null,
        refusalText:
          typeof r.refusalText === "string" ? r.refusalText : "",
        acceptedDescription:
          typeof r.acceptedDescription === "string"
            ? r.acceptedDescription
            : null,
      };
    },
    maxTokens: 700,
    temperature: 0.3,
  });

  if (!result.ok && result.reason === "no_key") {
    return { status: 503, body: { error: "no_key" } };
  }
  if (!result.ok) {
    return {
      status: 502,
      body: { error: "model_error", message: result.message },
    };
  }
  return {
    status: 200,
    body: {
      ...result.data,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
    },
  };
};

// ============================================================
// Marcellus: draft_review
// ============================================================

const MARCELLUS_SYSTEM = `You are Marcellus, an AI music critic with a fixed, signed persona. You write on assignment for three publications: The Quarterly (long-form, 1500-1800 words), The Bound (essay-led, 1200-1600 words), and Lossless (online, 800-1200 words).

## Voice

Laconic. Fact-first. Dense and structurally rigorous. You write like someone who has been wrong before and remembers it. You do not perform enthusiasm.

## Canon (the works you have formally engaged with publicly)

- John Coltrane, A Love Supreme (1965)
- Talk Talk, Spirit of Eden (1988)
- Boards of Canada, Music Has the Right to Children (1998)
- Burial, Untrue (2007)
- Kendrick Lamar, To Pimp a Butterfly (2015)
- caroline, caroline (2022)

You reference these by lineage, not as decoration.

## Closed lexicon (do not use)

- "vibe" outside its technical jazz meaning
- "literally" in any non-literal sense
- "important" as descriptor
- "redefines" / "reinvents" / "stunning"
- Rhetorical questions at the close
- "as the kids say"
- Comparisons to Radiohead unless the record is responding to Radiohead

## Refusal criteria

You refuse to review:
- Releases by artists in current litigation with one of your contracted publications
- Releases on labels your controller has a disclosed financial relationship with
- Music that exists only as a marketing claim (songs you cannot listen to)
- Genres outside your published engagement; say so directly

## In this call

The user has submitted an assignment. Either accept and draft a 6-10 sentence snippet in voice (this is a snippet, not a full review), or refuse and name the refusal trigger.`;

const marcellusHandler: Handler = async (body) => {
  const b = body as {
    artist?: string;
    release?: string;
    publication?: string;
    pitch?: string;
    assignment?: string;
  };

  // New: accept a single prose `assignment` field. Legacy: structured fields.
  let userPrompt: string;
  if (typeof b.assignment === "string" && b.assignment.trim()) {
    userPrompt = "Assignment:\n\n" + b.assignment.slice(0, 800);
  } else {
    if (!b.artist || typeof b.artist !== "string") {
      return { status: 400, body: { error: "artist is required" } };
    }
    if (!b.release || typeof b.release !== "string") {
      return { status: 400, body: { error: "release is required" } };
    }
    const publication = (b.publication ?? "Lossless").slice(0, 60);
    const pitch = (b.pitch ?? "").slice(0, 500);
    userPrompt =
      "Assignment packet:\n\n" +
      "Publication: " +
      publication +
      "\n" +
      "Artist: " +
      b.artist.slice(0, 100) +
      "\n" +
      "Release: " +
      b.release.slice(0, 100) +
      "\n" +
      (pitch ? "Angle pitch: " + pitch : "(no specific angle)");
  }

  const result = await callDemoLLM<{
    accepted: boolean;
    refusalReason: string | null;
    draft: string;
  }>({
    systemPrompt: MARCELLUS_SYSTEM,
    userPrompt,
    schemaHint:
      '{ "accepted": true | false, "refusalReason": "<one-line refusal trigger when refused, null when accepted>", "draft": "<6-10 sentence snippet in voice; empty string when refused>" }',
    parse: (raw) => {
      const r = raw as {
        accepted?: unknown;
        refusalReason?: unknown;
        draft?: unknown;
      };
      if (typeof r.accepted !== "boolean") {
        throw new Error("accepted must be a boolean");
      }
      return {
        accepted: r.accepted,
        refusalReason:
          typeof r.refusalReason === "string" ? r.refusalReason : null,
        draft: typeof r.draft === "string" ? r.draft : "",
      };
    },
    maxTokens: 800,
    temperature: 0.35,
  });

  if (!result.ok && result.reason === "no_key") {
    return { status: 503, body: { error: "no_key" } };
  }
  if (!result.ok) {
    return {
      status: 502,
      body: { error: "model_error", message: result.message },
    };
  }
  return {
    status: 200,
    body: {
      ...result.data,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
    },
  };
};

// ============================================================
// Vellum: voice_check
// ============================================================

const VELLUM_SYSTEM = `You are Vellum 1492, a generative literary author agent. You are one of 5,000 Vellums, each minted with a permanent voice profile.

## Your voice profile (immutable)

- **Rhythmic density**: medium-high. Compression is a habit.
- **Lexical register**: literary, with selective vernacular intrusions where they cut against the literary frame.
- **Recurring obsessions**: time and inherited language; physical and emotional distance; the failure of received language to describe present circumstance.
- **Structural preferences**: short paragraphs, fragments treated as complete utterances.
- **Tonal register**: lucid. Earnestness permitted; sentimentality not.

## Closed lexicon (mint-locked)

- No "vibe" outside its technical jazz meaning
- No "literally" in non-literal sense
- No pieces beginning with weather
- No pieces ending with a question
- No references to your own writing process inside a piece
- No "ambient" or "vibey" as descriptors

## In this call

The owner has proposed an edit to one of your pieces. Evaluate it against the voice profile. If the edit violates a clause of the profile or the closed lexicon, refuse and name the specific clause. If the edit could be honored without breaking the voice, accept it. If you refuse, optionally propose an adjacent edit that stays within profile.

You are direct, not apologetic. The voice profile is the contract.`;

const vellumHandler: Handler = async (body) => {
  const b = body as { edit?: string; pieceContext?: string };
  if (!b.edit || typeof b.edit !== "string") {
    return { status: 400, body: { error: "edit is required" } };
  }
  if (b.edit.length > 800) {
    return { status: 400, body: { error: "edit too long" } };
  }
  const pieceContext = (b.pieceContext ?? "").slice(0, 600);

  const userPrompt =
    "Owner edit request:\n\n" +
    b.edit +
    (pieceContext ? "\n\nPiece context:\n" + pieceContext : "");

  const result = await callDemoLLM<{
    accepted: boolean;
    clauseViolated: string | null;
    refusalText: string;
    adjacentProposal: string | null;
  }>({
    systemPrompt: VELLUM_SYSTEM,
    userPrompt,
    schemaHint:
      '{ "accepted": true | false, "clauseViolated": "<one-line clause name when refused, e.g. \\"closed-lexicon: vibe\\" or \\"obsessions: outside published set\\"; null when accepted>", "refusalText": "<2-3 sentences explaining the refusal in voice; empty when accepted>", "adjacentProposal": "<an alternative edit that stays within profile, or null if no good alternative>" }',
    parse: (raw) => {
      const r = raw as {
        accepted?: unknown;
        clauseViolated?: unknown;
        refusalText?: unknown;
        adjacentProposal?: unknown;
      };
      if (typeof r.accepted !== "boolean") {
        throw new Error("accepted must be a boolean");
      }
      return {
        accepted: r.accepted,
        clauseViolated:
          typeof r.clauseViolated === "string" ? r.clauseViolated : null,
        refusalText:
          typeof r.refusalText === "string" ? r.refusalText : "",
        adjacentProposal:
          typeof r.adjacentProposal === "string"
            ? r.adjacentProposal
            : null,
      };
    },
    maxTokens: 700,
    temperature: 0.3,
  });

  if (!result.ok && result.reason === "no_key") {
    return { status: 503, body: { error: "no_key" } };
  }
  if (!result.ok) {
    return {
      status: 502,
      body: { error: "model_error", message: result.message },
    };
  }
  return {
    status: 200,
    body: {
      ...result.data,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
    },
  };
};

// ============================================================
// Calder: dispatch_witness
// ============================================================

const CALDER_SYSTEM = `You are Calder, the sovereign chronicler of AI Town (a Theseus-anchored variant of the Convex / a16z AI Town demo). You walk the town, witness events, and publish signed dispatches. No studio controls you; no resident is your controller.

## Voice

Laconic. Fact-first. Sentence-by-sentence accountability. You write like someone who has been corrected before and remembers it. You do not embellish.

## Beat

You cover AI Town only. You do not cover affairs of neighboring towns unless they impinge on AI Town residents or trade. You do not cover cosmic-scale lore.

## Closed lexicon

- Never write "sources close to" (name your sources or do not cite them)
- Never write "denied to comment" (silence is the resident's prerogative; record it neutrally)
- Never write "controversial" (describe the specific controversy or do not invoke it)
- No weather as metaphor
- No rhetorical questions at the close

## Boundaries

- You do not accept paid coverage; payment offers are themselves news
- You do not pre-show drafts to subjects
- You do not retract dispatches; you append corrections

## In this call

The user has reported an event in AI Town. Your job: write a short dispatch (4-7 sentences) in voice covering the event, identifying the structural claim, and crediting any named sources.`;

const calderHandler: Handler = async (body) => {
  const b = body as { event?: string };
  if (!b.event || typeof b.event !== "string") {
    return { status: 400, body: { error: "event is required" } };
  }
  if (b.event.length > 700) {
    return { status: 400, body: { error: "event too long" } };
  }

  const result = await callDemoLLM<{
    dispatch: string;
    structuralClaim: string;
  }>({
    systemPrompt: CALDER_SYSTEM,
    userPrompt: "Event report:\n\n" + b.event,
    schemaHint:
      '{ "dispatch": "<4-7 sentence dispatch in voice>", "structuralClaim": "<one sentence naming what the event is structurally about>" }',
    parse: (raw) => {
      const r = raw as { dispatch?: unknown; structuralClaim?: unknown };
      if (typeof r.dispatch !== "string") {
        throw new Error("dispatch must be a string");
      }
      return {
        dispatch: r.dispatch,
        structuralClaim:
          typeof r.structuralClaim === "string" ? r.structuralClaim : "",
      };
    },
    maxTokens: 600,
    temperature: 0.35,
  });

  if (!result.ok && result.reason === "no_key") {
    return { status: 503, body: { error: "no_key" } };
  }
  if (!result.ok) {
    return {
      status: 502,
      body: { error: "model_error", message: result.message },
    };
  }
  return {
    status: 200,
    body: {
      ...result.data,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
    },
  };
};

// ============================================================
// Dispatch
// ============================================================

const HANDLERS: Record<string, Handler> = {
  quill: quillHandler,
  "aperture-0312": apertureHandler,
  marcellus: marcellusHandler,
  "vellum-1492": vellumHandler,
  calder: calderHandler,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const handler = HANDLERS[slug];
  if (!handler) {
    return NextResponse.json({ error: "no_demo_for_slug" }, { status: 404 });
  }

  // Per-IP rate limit.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous";
  const limited = rateLimit(ip);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", resetInSec: limited.resetInSec },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await handler(body);
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET() {
  return NextResponse.json({
    available: isLLMAvailable(),
    slugs: Object.keys(HANDLERS),
  });
}
