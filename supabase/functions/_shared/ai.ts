// What every AI Edge Function needs: CORS, the signed-in admin check (AI is
// an admin trial for now), token cost and the ai_generations log.
import { db } from "./dodo.ts";

const ALLOWED_ORIGINS = [
  "https://khulqidesign.com",
  "https://www.khulqidesign.com",
  "http://localhost:5173",
];
const PUBLISHABLE_KEY = "sb_publishable_IxJSv34yZhNyGkgWbvYAjg_UFmo6CDO";

export const MODEL = "claude-opus-5-5";
// USD per million tokens for claude-opus-5-5 (cache writes are 1.25x input)
const PRICE = { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 };

export function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

// the signed-in person and whether they're an admin; null when not signed in
export async function whoIs(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.startsWith("sb_")) return null;
  const base = Deno.env.get("SUPABASE_URL")!;
  const asUser = { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
  const userRes = await fetch(`${base}/auth/v1/user`, { headers: asUser });
  if (!userRes.ok) return null;
  const userId = (await userRes.json()).id as string;
  const adminRes = await fetch(`${base}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { ...asUser, "Content-Type": "application/json" },
    body: "{}",
  });
  return { userId, isAdmin: adminRes.ok && (await adminRes.json()) === true };
}

export type Tally = { input: number; cacheWrite: number; cacheRead: number; output: number; model: string };
export const newTally = (): Tally => ({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0, model: MODEL });

// deno-lint-ignore no-explicit-any
export function addUsage(tally: Tally, response: any) {
  const u = response.usage ?? {};
  tally.input += u.input_tokens ?? 0;
  tally.cacheWrite += u.cache_creation_input_tokens ?? 0;
  tally.cacheRead += u.cache_read_input_tokens ?? 0;
  tally.output += u.output_tokens ?? 0;
  tally.model = response.model ?? tally.model;
}

export const costOf = (t: Tally) =>
  (t.input * PRICE.input + t.cacheWrite * PRICE.cacheWrite + t.cacheRead * PRICE.cacheRead + t.output * PRICE.output) / 1e6;

// what the browser is shown about one generation
export const usageOf = (t: Tally, started: number, passes = 1) => ({
  model: t.model,
  input: t.input + t.cacheWrite,
  cached: t.cacheRead,
  output: t.output,
  costUsd: Math.round(costOf(t) * 1e4) / 1e4,
  seconds: Math.round((Date.now() - started) / 100) / 10,
  passes,
});

// one row in ai_generations; never lets logging break the result
// deno-lint-ignore no-explicit-any
export async function logGeneration(row: Record<string, any>, tally: Tally, started: number) {
  const res = await db("ai_generations?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      model: tally.model,
      input_tokens: tally.input,
      cache_write_tokens: tally.cacheWrite,
      cache_read_tokens: tally.cacheRead,
      output_tokens: tally.output,
      cost_usd: Math.round(costOf(tally) * 1e5) / 1e5,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      ...row,
    }),
  }).catch(() => null);
  return res?.ok ? (await res.json())[0]?.id ?? null : null;
}
