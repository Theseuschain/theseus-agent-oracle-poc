import { NextRequest, NextResponse } from "next/server";
import { decideTerra, TerraDecideInput } from "@/lib/terra-llm";

export const dynamic = "force-dynamic";
export const maxDuration = 35;

export async function POST(req: NextRequest) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY not configured on the server" },
      { status: 503 },
    );
  }

  let input: TerraDecideInput;
  try {
    input = (await req.json()) as TerraDecideInput;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!input.vault || !input.action || typeof input.ustdAmount !== "number") {
    return NextResponse.json({ error: "missing vault / action / ustdAmount" }, { status: 400 });
  }
  if (input.action !== "MINT" && input.action !== "REDEEM") {
    return NextResponse.json({ error: "action must be MINT or REDEEM" }, { status: 400 });
  }

  try {
    const verdict = await decideTerra(input);
    return NextResponse.json(verdict);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
