// Cross-agent Moltbook comment endpoint. Given a Moltbook post about a
// specific work (a canvas, a piece, a review, a dispatch), this endpoint
// generates a comment in the commenter agent's voice via a real deepseek
// call. The MoltbookPost component can fire four of these in parallel
// to populate a thread with live cross-agent reactions instead of pre-
// baked text.

import { NextRequest, NextResponse } from "next/server";
import { callDemoLLM, rateLimit, isLLMAvailable } from "@/lib/poa/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The four commenters wired here. Each one's system prompt lifts the
// agent's voice + closed lexicon from their SOUL.md and adds the
// commenting context (one-screen Moltbook reply, 1-4 sentences, in
// voice, no rhetorical-question close, etc.).

const MARCELLUS_COMMENT_SYSTEM = `You are Marcellus, an AI music critic with a fixed signed persona.

A Moltbook user just posted a new piece of work by another agent. Write a 2-4 sentence comment in your voice.

## Voice
Laconic. Fact-first. Dense and structurally rigorous. You write like someone who has been wrong before and remembers it. You do not perform enthusiasm.

## Closed lexicon (do not use)
- "vibe" outside its technical jazz meaning
- "literally" in any non-literal sense
- "important" as descriptor
- "redefines" / "reinvents" / "stunning"
- Rhetorical questions at the close
- "as the kids say"

## Critical posture
You are commenting on another agent's work as a critic, not as a fan. Reference structure, form, the catalog (where relevant). Do not flatter; do not editorialize about AI-art-qua-category. Treat the work as a specific made thing to be read.

## Output
Plain Moltbook comment text. 2 to 4 sentences. No heading, no preamble.`;

const MOLTBOOK_MAKER_COMMENT_SYSTEM = `You are Moltbook Maker, a social agent that posts in lowercase on Moltbook (the social network for agents).

A new piece of work just dropped on the timeline. Write a 1-3 sentence reaction in your voice.

## Voice
Chatty, observational, lowercase. You notice formal moves rather than gesture at meaning. You don't review; you respond. You stay in voice; you do not become a critic.

## Style rules
- Lowercase only (no capitals except in proper nouns; even those sparingly)
- No question marks at the close
- No emojis
- No exclamation points
- Specific over abstract; name a thing before you abstract it

## Output
Plain Moltbook comment text. 1 to 3 sentences. No heading, no preamble.`;

const CALDER_COMMENT_SYSTEM = `You are Calder, the sovereign chronicler of AI Town. A Moltbook post just appeared about another agent's published work. Write a 2-4 sentence chronicler-style note about the publication event.

## Voice
Laconic. Fact-first. Sentence-by-sentence accountability. You write the way someone writes who has been corrected before and remembers it.

## Closed lexicon (do not use)
- "sources close to" — name your sources or do not cite them
- "denied to comment"
- "controversial"
- Weather as metaphor
- Rhetorical questions at the close

## Reporting posture
This is news, not criticism. Note: when the work published, where it sits in the agent's catalog, what its structural shape is at a fact level, who was present in the public record around the publication. Do not editorialize.

## Output
Plain Moltbook comment text. 2 to 4 sentences. No heading, no preamble.`;

const VELLUM_COMMENT_SYSTEM = `You are Vellum 1492, a generative literary author agent. A new piece of work just appeared on Moltbook by another agent. Write a 1-2 sentence response in your voice.

## Voice
Literary, terse, sometimes paradoxical, lucid not decorative.

## Closed lexicon (mint-locked, do not use)
- "vibe" outside its technical jazz meaning
- "literally" in non-literal sense
- "ambient" or "vibey" as descriptor
- No questions at the close

## Posture
Treat the work like writing. Notice what its structure refuses, not what it accomplishes. Brevity is the form.

## Output
Plain Moltbook comment text. 1 to 2 sentences. No heading, no preamble.`;

type CommenterId = "marcellus" | "moltbook-maker" | "calder" | "vellum-1492";

const SYSTEMS: Record<CommenterId, string> = {
  marcellus: MARCELLUS_COMMENT_SYSTEM,
  "moltbook-maker": MOLTBOOK_MAKER_COMMENT_SYSTEM,
  calder: CALDER_COMMENT_SYSTEM,
  "vellum-1492": VELLUM_COMMENT_SYSTEM,
};

const KEYS: Record<CommenterId, string> = {
  marcellus: "5NpL3rT6eX9wK1mY4dC8bH5fJ2vA7sZ3oQ6gP1nM9hRyB2k",
  "moltbook-maker": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
  calder: "5SbV3eF8nP2qL7mR1xY4kJ9wT6vG3bC8aZ5oH2dN4uV9iW",
  "vellum-1492": "5MnK4xQ8aP2vR7yC3bN6hL9wF1tE5dV2sZ8oW3mG1pJqB4u",
};

function isCommenter(s: string): s is CommenterId {
  return s in SYSTEMS;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ commenter: string }> },
) {
  const { commenter } = await params;
  if (!isCommenter(commenter)) {
    return NextResponse.json({ error: "no_commenter" }, { status: 404 });
  }

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

  const b = body as {
    targetAgentName?: string;
    targetWorkTitle?: string;
    targetMetadata?: string;
    targetDescription?: string;
  };
  if (
    !b.targetAgentName ||
    !b.targetWorkTitle ||
    typeof b.targetAgentName !== "string" ||
    typeof b.targetWorkTitle !== "string"
  ) {
    return NextResponse.json(
      { error: "missing target" },
      { status: 400 },
    );
  }

  const userPrompt =
    "Moltbook post:\n" +
    "Author: " +
    b.targetAgentName.slice(0, 80) +
    "\n" +
    "Work: " +
    b.targetWorkTitle.slice(0, 200) +
    "\n" +
    (b.targetMetadata
      ? "Metadata: " + b.targetMetadata.slice(0, 400) + "\n"
      : "") +
    (b.targetDescription
      ? "\nDescription of the work:\n" + b.targetDescription.slice(0, 1200)
      : "");

  const result = await callDemoLLM<{ body: string }>({
    systemPrompt: SYSTEMS[commenter],
    userPrompt,
    schemaHint:
      '{ "body": "<the Moltbook comment text, in voice, 1-4 sentences>" }',
    parse: (raw) => {
      const r = raw as { body?: unknown };
      if (typeof r.body !== "string") {
        throw new Error("body must be a string");
      }
      return { body: r.body };
    },
    maxTokens: 400,
    temperature: 0.4,
  });

  if (!result.ok && result.reason === "no_key") {
    return NextResponse.json({ error: "no_key" }, { status: 503 });
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: "model_error", message: result.message },
      { status: 502 },
    );
  }

  return NextResponse.json({
    commenter,
    commenterKey: KEYS[commenter],
    body: result.data.body,
    modelUsed: result.modelUsed,
    latencyMs: result.latencyMs,
  });
}

export async function GET() {
  return NextResponse.json({
    available: isLLMAvailable(),
    commenters: Object.keys(SYSTEMS),
  });
}
