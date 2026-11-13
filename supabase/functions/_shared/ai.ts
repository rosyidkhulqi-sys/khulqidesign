// What every AI Edge Function needs: CORS, the signed-in admin check (AI is
// an admin trial for now), token cost and the ai_generations log.
import { db } from "./dodo.ts";

const ALLOWED_ORIGINS = [
  "https://khulqidesign.com",
  "https://www.khulqidesign.com",
  "http://localhost:5173",
];
const PUBLISHABLE_KEY = "sb_publishable_IxJSv34yZhNyGkgWbvYAjg_UFmo6CDO";

// The models, cheapest first. Each task picks the least it needs, and can be
// switched with a function secret (AI_TEMPLATE_MODEL, AI_RESIZE_MODEL)
// without a redeploy. USD per million tokens; cache writes are 1.25x input.
export const HAIKU = "claude-haiku-5-5";
export const SONNET = "claude-sonnet-5-5";
export const OPUS = "claude-opus-5-5";
const PRICES: Record<string, { input: number; cacheWrite: number; cacheRead: number; output: number }> = {
  [HAIKU]: { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
  [SONNET]: { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
  [OPUS]: { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
};
const KNOWN = Object.keys(PRICES);

// the model a task uses: its secret if set to a known model, else the default
export function modelFor(secret: string, fallback: string) {
  const chosen = Deno.env.get(secret)?.trim();
  return chosen && KNOWN.includes(chosen) ? chosen : fallback;
}

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

// tokens and dollars over every call of one generation; model lists each
// model that ran, in order ("claude-haiku-5-5 > claude-sonnet-5-5")
export type Tally = { input: number; cacheWrite: number; cacheRead: number; output: number; cost: number; model: string };
export const newTally = (): Tally => ({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0, cost: 0, model: "" });

// deno-lint-ignore no-explicit-any
export function addUsage(tally: Tally, response: any) {
  const u = response.usage ?? {};
  const price = PRICES[response.model] ?? PRICES[OPUS];
  const add = { input: u.input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, output: u.output_tokens ?? 0 };
  tally.input += add.input;
  tally.cacheWrite += add.cacheWrite;
  tally.cacheRead += add.cacheRead;
  tally.output += add.output;
  tally.cost += (add.input * price.input + add.cacheWrite * price.cacheWrite + add.cacheRead * price.cacheRead + add.output * price.output) / 1e6;
  tally.model = tally.model ? `${tally.model} > ${response.model}` : response.model;
}

export const costOf = (t: Tally) => t.cost;

// One structured call: the answer is held to the JSON schema and parsed.
// Haiku has no server-side fallback; Sonnet and Opus fall back on a decline.
export async function askJson(
  // deno-lint-ignore no-explicit-any
  client: any,
  { model, effort, system, message, schema }: { model: string; effort: string; system: string; message: string; schema: unknown },
  tally: Tally,
) {
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    ...(model === HAIKU ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
    output_config: { effort, format: { type: "json_schema", schema } },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: message }],
  });
  addUsage(tally, response);
  if (response.stop_reason === "refusal") throw Object.assign(new Error("refused"), { code: "refused" });
  if (response.stop_reason === "max_tokens") throw Object.assign(new Error("too long"), { code: "too_long" });
  // deno-lint-ignore no-explicit-any
  return JSON.parse((response.content as any[]).find((b) => b.type === "text")?.text ?? "{}");
}

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
