// Template from text: a brief in, an editable Create design out.
//
// POST { prompt: string, brief?: { format, style, colors, content } }
//   -> { id, template: { title, scene }, usage, checks }
//
// Claude lays the design out as the same scene data our built-in templates use
// (shapes and text on one artboard), so Create opens it like any template and
// every part stays editable. The answer is held to a JSON schema, cleaned, and
// its layout checked (colliding text, text off the page, empty stretches). When
// the check finds problems, Claude gets one more pass with the list to fix them.
// Every generation is logged in ai_generations: the brief, the result, tokens,
// cost and time, so prompts and prices can be tuned from real data.
//
// While this is being tried out only admins get through, so nobody else
// spends the API credit. ANTHROPIC_API_KEY lives in the function's secrets.
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { db } from "../_shared/dodo.ts";
import { type Brief, briefText, clean, FORMATS, inspect, SCHEMA, SYSTEM } from "./design.ts";

const ALLOWED_ORIGINS = [
  "https://khulqidesign.com",
  "https://www.khulqidesign.com",
  "http://localhost:5173",
];
const PUBLISHABLE_KEY = "sb_publishable_IxJSv34yZhNyGkgWbvYAjg_UFmo6CDO";
const MODEL = "claude-opus-5-5";
const MAX_PROMPT = 600;

// USD per million tokens for claude-opus-5-5 (cache writes are 1.25x input)
const PRICE = { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 };

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

type Tally = { input: number; cacheWrite: number; cacheRead: number; output: number; model: string };

// one call to Claude for a design; returns the parsed JSON and adds the usage up
async function design(client: Anthropic, message: string, tally: Tally) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // a declined request is retried on the fallback model the API picks
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SCHEMA },
    },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: message }],
    // deno-lint-ignore no-explicit-any
  } as any);
  // deno-lint-ignore no-explicit-any
  const u = response.usage as any;
  tally.input += u.input_tokens ?? 0;
  tally.cacheWrite += u.cache_creation_input_tokens ?? 0;
  tally.cacheRead += u.cache_read_input_tokens ?? 0;
  tally.output += u.output_tokens ?? 0;
  tally.model = response.model;
  if (response.stop_reason === "refusal") throw Object.assign(new Error("refused"), { code: "refused" });
  if (response.stop_reason === "max_tokens") throw Object.assign(new Error("too long"), { code: "too_long" });
  // deno-lint-ignore no-explicit-any
  const text = (response.content as any[]).find((b) => b.type === "text")?.text ?? "";
  return JSON.parse(text);
}

const costOf = (t: Tally) =>
  (t.input * PRICE.input + t.cacheWrite * PRICE.cacheWrite + t.cacheRead * PRICE.cacheRead + t.output * PRICE.output) / 1e6;

// only what the brief may hold reaches the prompt and the log
// deno-lint-ignore no-explicit-any
function readBrief(raw: any): Brief {
  if (!raw || typeof raw !== "object") return {};
  return {
    format: FORMATS.some((f) => f.label === raw.format) ? raw.format : undefined,
    style: typeof raw.style === "string" ? raw.style.slice(0, 20) : undefined,
    colors: Array.isArray(raw.colors) ? raw.colors.filter((c: unknown) => typeof c === "string").slice(0, 4) : [],
    content: Array.isArray(raw.content)
      ? raw.content.slice(0, 12).map((c: { field?: unknown; text?: unknown }) => ({
        field: String(c?.field ?? "").slice(0, 20),
        text: typeof c?.text === "string" ? c.text.slice(0, 300) : "",
      }))
      : [],
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405, origin);

  let isAdmin = false;
  let userId = "";
  let prompt = "";
  let brief: Brief = {};
  const started = Date.now();
  const tally: Tally = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, model: MODEL };

  // deno-lint-ignore no-explicit-any
  const log = async (row: Record<string, any>) => {
    const res = await db("ai_generations?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        kind: "template",
        prompt,
        brief,
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
    // logging never breaks the design itself
    return res?.ok ? (await res.json())[0]?.id ?? null : null;
  };

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || token.startsWith("sb_")) return reply({ error: "sign_in_required" }, 401, origin);

    const base = Deno.env.get("SUPABASE_URL")!;
    const asUser = { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
    const userRes = await fetch(`${base}/auth/v1/user`, { headers: asUser });
    if (!userRes.ok) return reply({ error: "sign_in_required" }, 401, origin);
    userId = (await userRes.json()).id;

    const adminRes = await fetch(`${base}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: { ...asUser, "Content-Type": "application/json" },
      body: "{}",
    });
    isAdmin = adminRes.ok && (await adminRes.json()) === true;
    // trial: admins only, until credits are in place
    if (!isAdmin) return reply({ error: "not_open" }, 403, origin);

    const body = await req.json();
    prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT) : "";
    brief = readBrief(body.brief);
    if (!prompt) return reply({ error: "empty_prompt" }, 400, origin);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return reply({ error: "not_configured", detail: "ANTHROPIC_API_KEY is not set in the function secrets." }, 503, origin);
    const client = new Anthropic({ apiKey: key });

    const ask = briefText(prompt, brief);
    let template = clean(await design(client, `Design this.\n\n${ask}`, tally), brief.format);
    const found = inspect(template.scene);
    let fixed = false;

    // one more pass when the layout check found problems; kept only if it is better
    if (found.length) {
      const draft = JSON.stringify({ title: template.title, format: template.format, bg: template.scene.bg, elements: template.scene.elements });
      const second = clean(
        await design(
          client,
          `Here is your first draft for this brief, and what a layout review found. Fix every problem while keeping the idea, palette and copy. Return the complete corrected design.\n\nBRIEF\n${ask}\n\nREVIEW\n- ${found.join("\n- ")}\n\nDRAFT\n${draft}`,
          tally,
        ),
        brief.format,
      );
      const left = inspect(second.scene);
      if (left.length < found.length && second.scene.elements.length) {
        template = second;
        fixed = true;
      }
    }
    if (template.scene.elements.length === 0) {
      await log({ status: "failed", checks: { found } });
      return reply({ error: "empty_design" }, 502, origin);
    }

    const checks = { found, fixed, left: fixed ? inspect(template.scene) : found };
    const result = { title: template.title, scene: template.scene };
    const id = await log({ result, checks });
    const usage = {
      model: tally.model,
      input: tally.input + tally.cacheWrite,
      cached: tally.cacheRead,
      output: tally.output,
      costUsd: Math.round(costOf(tally) * 1e4) / 1e4,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      passes: found.length ? 2 : 1,
    };
    return reply({ id, template: result, usage, checks }, 200, origin);
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const code = (e as any)?.code;
    if (userId && isAdmin && prompt) await log({ status: code === "refused" ? "refused" : "failed" });
    if (code) return reply({ error: code }, code === "refused" ? 422 : 502, origin);
    const status = e instanceof Anthropic.RateLimitError ? 429 : 500;
    return reply({ error: "failed", detail: isAdmin ? String((e as Error)?.message ?? e) : undefined }, status, origin);
  }
});
