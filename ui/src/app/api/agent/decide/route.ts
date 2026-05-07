import { NextRequest, NextResponse } from "next/server";
import { decide, AgentDecisionInput } from "@/lib/agent-llm";

export const dynamic = "force-dynamic";
export const maxDuration = 35; // seconds — DeepSeek call takes 2-10s typically

export async function POST(req: NextRequest) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY not configured on the server" },
      { status: 503 },
    );
  }

  let input: AgentDecisionInput;
  try {
    input = (await req.json()) as AgentDecisionInput;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(input.venues) || input.venues.length !== 3) {
    return NextResponse.json(
      { error: "expected exactly 3 venues" },
      { status: 400 },
    );
  }

  try {
    const out = await decide(input);
    return NextResponse.json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
