// Thin wrapper around the DeepSeek API for the in-page agent demos.
// DeepSeek is OpenAI-compatible so we use the `openai` SDK with a
// pointed-at-DeepSeek baseURL. Set DEEPSEEK_API_KEY in .env.local.
//
// All demo handlers route through callDemoLLM which:
//  - falls back to scripted (returns null) when the key is unset
//  - enforces JSON-shaped output via response_format
//  - returns parsed JSON or throws on parse failure (handler catches)
//
// This is a server-side module. Do not import from client code.

import OpenAI from "openai";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

let cached: OpenAI | null = null;
function getClient(): OpenAI | null {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  if (cached) return cached;
  cached = new OpenAI({ apiKey: key, baseURL: DEEPSEEK_BASE_URL });
  return cached;
}

export function isLLMAvailable(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

export type DemoLLMArgs<T> = {
  systemPrompt: string;
  userPrompt: string;
  // JSON schema the model is asked to output. Loose JSON-mode contract.
  schemaHint: string;
  // Validates and parses the raw response JSON into the expected shape.
  parse: (raw: unknown) => T;
  model?: string;
  // Max tokens; default is generous for typical demo responses.
  maxTokens?: number;
  // Temperature; default low for consistency in demos.
  temperature?: number;
};

export type DemoLLMResult<T> =
  | { ok: true; data: T; modelUsed: string; latencyMs: number }
  | { ok: false; reason: "no_key" }
  | { ok: false; reason: "model_error"; message: string };

export async function callDemoLLM<T>(
  args: DemoLLMArgs<T>,
): Promise<DemoLLMResult<T>> {
  const client = getClient();
  if (!client) return { ok: false, reason: "no_key" };
  const model = args.model ?? DEFAULT_MODEL;
  const startedAt = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model,
      max_tokens: args.maxTokens ?? 800,
      temperature: args.temperature ?? 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            args.systemPrompt +
            "\n\n## Required output\n" +
            "Respond with a single JSON object matching this shape:\n" +
            args.schemaHint +
            "\nReturn only the JSON object. No prose outside the JSON.",
        },
        { role: "user", content: args.userPrompt },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        reason: "model_error",
        message: "Model did not return valid JSON. Raw: " + text.slice(0, 200),
      };
    }
    const data = args.parse(parsed);
    return {
      ok: true,
      data,
      modelUsed: model,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "model_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// Simple per-IP token bucket. In-memory; resets on process restart. Adequate
// for a demo behind a single dev server; for production we'd swap this for
// the Vercel KV-backed pattern used elsewhere in this codebase.

type Bucket = { tokens: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const RATE_LIMIT_PER_HOUR = 30;

export function rateLimit(ip: string): {
  ok: boolean;
  remaining: number;
  resetInSec: number;
} {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  let bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    bucket = { tokens: RATE_LIMIT_PER_HOUR, resetAt: now + oneHour };
    buckets.set(ip, bucket);
  }
  if (bucket.tokens <= 0) {
    return {
      ok: false,
      remaining: 0,
      resetInSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  bucket.tokens -= 1;
  return {
    ok: true,
    remaining: bucket.tokens,
    resetInSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}
