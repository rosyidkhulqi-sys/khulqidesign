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
import { askJson, logGeneration, modelFor, newTally, reply, SONNET, usageOf, whoIs } from "../_shared/ai.ts";
import { type Brief, briefText, clean, FORMATS, inspect, SCHEMA, SYSTEM } from "./design.ts";

const MAX_PROMPT = 600;

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
  if (req.method === "OPTIONS") return reply("ok", 200, origin);
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405, origin);

  let who: Awaited<ReturnType<typeof whoIs>> = null;
  let prompt = "";
  let brief: Brief = {};
  const started = Date.now();
  const tally = newTally();
  // deno-lint-ignore no-explicit-any
  const log = (row: Record<string, any>) =>
    logGeneration({ user_id: who!.userId, kind: "template", prompt, brief, ...row }, tally, started);

  try {
    who = await whoIs(req);
    if (!who) return reply({ error: "sign_in_required" }, 401, origin);
    // trial: admins only, until credits are in place
    if (!who.isAdmin) return reply({ error: "not_open" }, 403, origin);

    const body = await req.json();
    prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT) : "";
    brief = readBrief(body.brief);
    if (!prompt) return reply({ error: "empty_prompt" }, 400, origin);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return reply({ error: "not_configured", detail: "ANTHROPIC_API_KEY is not set in the function secrets." }, 503, origin);
    const client = new Anthropic({ apiKey: key });
    // a design from nothing needs taste: Sonnet by default, half Opus's price
    const model = modelFor("AI_TEMPLATE_MODEL", SONNET);
    const design = (message: string) => askJson(client, { model, effort: "medium", system: SYSTEM, message, schema: SCHEMA }, tally);

    const ask = briefText(prompt, brief);
    let template = clean(await design(`Design this.\n\n${ask}`), brief.format);
    const found = inspect(template.scene);
    let fixed = false;

    // one more pass when the layout check found problems; kept only if it is better
    if (found.length) {
      const draft = JSON.stringify({ title: template.title, format: template.format, bg: template.scene.bg, elements: template.scene.elements });
      const second = clean(
        await design(
          `Here is your first draft for this brief, and what a layout review found. Fix every problem while keeping the idea, palette and copy. Return the complete corrected design.\n\nBRIEF\n${ask}\n\nREVIEW\n- ${found.join("\n- ")}\n\nDRAFT\n${draft}`,
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
    return reply({ id, template: result, usage: usageOf(tally, started, found.length ? 2 : 1), checks }, 200, origin);
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const code = (e as any)?.code;
    if (who?.isAdmin && prompt) await log({ status: code === "refused" ? "refused" : "failed" });
    if (code) return reply({ error: code }, code === "refused" ? 422 : 502, origin);
    const status = e instanceof Anthropic.RateLimitError ? 429 : 500;
    return reply({ error: "failed", detail: who?.isAdmin ? String((e as Error)?.message ?? e) : undefined }, status, origin);
  }
});
