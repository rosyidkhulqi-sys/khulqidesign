// AI in Create's AI tab (admin trial, each use logged with its cost, to price
// KD AI credits later):
//   element: a vector element (SVG) drawn from a description, placed on the page
//   text:    headline or caption options in the tone asked
//
// POST { mode: "element", prompt }            -> { id, svg, title, usage }
// POST { mode: "text", prompt, tone, kind }   -> { id, options: [..], usage }
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { askJson, HAIKU, logGeneration, modelFor, newTally, reply, SONNET, usageOf, whoIs } from "../_shared/ai.ts";

const MAX_PROMPT = 600;
const MAX_SVG = 60_000;

const ELEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["svg", "title", "keywords", "category"],
  properties: {
    svg: { type: "string", description: "One standalone SVG, from <svg to </svg>" },
    title: { type: "string", description: "A short English name for the element, 1 to 4 words, as a stock site titles it" },
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "15 to 25 English stock keywords, most important first: the subject, its parts, style, mood, uses and themes; lowercase, one or two words each, no duplicates",
    },
    category: {
      type: "string",
      enum: ["graphics", "infographics", "shapes", "frames"],
      description: "graphics: illustrations and objects; infographics: charts, arrows, steps; shapes: plain geometric shapes; frames: borders and frames",
    },
  },
};

const ELEMENT_SYSTEM = `You are a senior vector illustrator making one design element for a graphic design editor (posters, social posts, cards). Draw what is described as a clean, flat vector illustration in SVG.

Style:
- Modern flat or lightly shaded vector, confident shapes, a small harmonious palette (3 to 6 colors) unless colors are asked for.
- One subject, centred, filling most of a square viewBox="0 0 512 512", with a little margin. Transparent background: no full-canvas background rectangle unless a background is asked for.
- Clear silhouettes that read at small sizes. Consistent stroke widths and corner rounding if strokes are used.
- No text or letters unless asked.

Craft (the drawing must look finished, with no visible mistakes):
- Highlights, shadows and patterns on a shape stay inside it: put the base shape in a <clipPath> and draw them clipped to it, so nothing pokes out past its edge.
- Parts that touch meet exactly (shared coordinates): a handle meets the body, a lid sits on its rim, with no gaps or overlaps that show.
- Symmetric things are symmetric; curves are smooth; no stray points or spikes.
- Before answering, check each shape against the others as if you saw the picture, and fix anything that sticks out or doesn't line up.

Rules for the SVG:
- xmlns="http://www.w3.org/2000/svg" and the viewBox; paths, basic shapes, groups, linear and radial gradients only.
- No <script>, <foreignObject>, <image>, <text> (unless asked), filters, event attributes, external links or fonts.
- Compact: no comments, rounded coordinates (at most 1 decimal).
- Every shape must be visible: no invisible helper shapes (fill="none" without a stroke, zero width or radius, opacity 0) and nothing outside the viewBox.
If the request can't be drawn (it asks for a real brand's logo, a real person, or harmful content), draw a simple neutral placeholder shape instead and name it "Placeholder".`;

const TEXT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["options"],
  properties: { options: { type: "array", items: { type: "string" }, description: "4 different options" } },
};

const TEXT_SYSTEM = `You write short copy for designs made in a graphic editor (posters, social posts, flyers, cards), in English unless the request is in another language.
Give 4 clearly different options. Headlines: 2 to 7 words, punchy, no ending period. Captions: one or two sentences, under 160 characters. Match the tone asked. No hashtags or emoji unless asked. No quotation marks around the options.`;

function clean(svg: string) {
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/<image[\s\S]*?(\/>|<\/image\s*>)/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return reply({}, 200, origin);
  const started = Date.now();
  const tally = newTally();
  let who = null;
  let kind = "create_element";
  let prompt = "";
  try {
    who = await whoIs(req);
    if (!who) return reply({ error: "sign_in_required" }, 401, origin);
    if (!who.isAdmin) return reply({ error: "not_open" }, 403, origin);

    const body = await req.json();
    const mode = body?.mode === "text" ? "text" : "element";
    kind = mode === "text" ? "create_text" : "create_element";
    prompt = String(body?.prompt ?? "").trim().slice(0, MAX_PROMPT);
    if (!prompt) return reply({ error: "empty_prompt" }, 400, origin);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return reply({ error: "not_configured" }, 503, origin);
    const client = new Anthropic({ apiKey: key });

    if (mode === "text") {
      const tone = String(body?.tone ?? "friendly").slice(0, 40);
      const what = body?.kind === "caption" ? "captions" : "headlines";
      const answer = await askJson(client, {
        model: modelFor("AI_TEXT_MODEL", HAIKU),
        effort: "low",
        system: TEXT_SYSTEM,
        message: `Write 4 ${what} in a ${tone} tone for: ${prompt}`,
        schema: TEXT_SCHEMA,
      }, tally);
      const options = (Array.isArray(answer?.options) ? answer.options : [])
        .map((o: unknown) => String(o).trim().replace(/^["“]|["”]$/g, "").slice(0, 240)).filter(Boolean).slice(0, 4);
      if (!options.length) throw Object.assign(new Error("empty"), { code: "bad_answer" });
      const id = await logGeneration({ user_id: who.userId, kind, prompt, brief: { tone, what }, result: { options } }, tally, started);
      return reply({ id, options, usage: usageOf(tally, started) }, 200, origin);
    }

    const answer = await askJson(client, {
      model: modelFor("AI_ELEMENT_MODEL", SONNET),
      effort: "high",
      system: ELEMENT_SYSTEM,
      message: `Draw: ${prompt}`,
      schema: ELEMENT_SCHEMA,
    }, tally);
    const svg = clean(String(answer?.svg ?? "")).trim();
    if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg) || svg.length > MAX_SVG) {
      throw Object.assign(new Error("bad svg"), { code: "bad_svg" });
    }
    const title = String(answer?.title ?? "AI element").slice(0, 60);
    const keywords = [...new Set((Array.isArray(answer?.keywords) ? answer.keywords : [])
      .map((k: unknown) => String(k).toLowerCase().trim()).filter((k: string) => k && k.length <= 30))].slice(0, 25);
    const category = ["graphics", "infographics", "shapes", "frames"].includes(answer?.category) ? answer.category : "graphics";
    const id = await logGeneration({ user_id: who.userId, kind, prompt, result: { title, keywords, category, svg } }, tally, started);
    return reply({ id, svg, title, keywords, category, usage: usageOf(tally, started) }, 200, origin);
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const code = (e as any)?.code;
    if (who?.isAdmin) {
      await logGeneration({ user_id: who.userId, kind, prompt: prompt || kind, status: code === "refused" ? "refused" : "failed" }, tally, started);
    }
    if (code) return reply({ error: code }, code === "refused" ? 422 : 502, origin);
    return reply({ error: "failed", detail: who?.isAdmin ? String((e as Error)?.message ?? e) : undefined }, 500, origin);
  }
});
