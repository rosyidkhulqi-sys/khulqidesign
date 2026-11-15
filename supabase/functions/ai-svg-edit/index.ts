// AI SVG edit: Edit an image, step two. Claude changes an SVG the way the
// person asks: swap or recolor a part, remove something, or extend the
// artwork to a wider or taller canvas. Claude can't draw pixels, but an SVG
// is code, so it can edit that. Admins only while it's tried out.
//
// POST { svg, instruction, image?, fix? } -> { id, svg, summary, usage }
//   image: the SVG drawn as a PNG (base64), so Claude sees the artwork, not
//   only its numbers; fix: the browser found problems in a first result and
//   sends it back with them listed in the instruction
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { askJson, logGeneration, modelFor, newTally, reply, SONNET, usageOf, whoIs } from "../_shared/ai.ts";

const MAX_IN = 50_000; // characters of SVG sent (the answer must fit 16k output tokens)
const MAX_OUT = 80_000;
const MAX_INSTRUCTION = 1200;
const MAX_IMAGE = 2_000_000; // base64 characters of the picture

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["svg", "summary"],
  properties: {
    svg: { type: "string", description: "The complete edited SVG document, from <svg to </svg>" },
    summary: { type: "string", description: "One short sentence on what was changed" },
  },
};

const SYSTEM = `You are a senior vector illustrator editing an existing SVG for a client. You get the SVG code and an instruction. Return the whole edited SVG.

How to edit:
- Do exactly what is asked and nothing more. Keep everything else as it is: same shapes, colors, strokes, proportions and style. Copy unchanged parts as they are.
- Match the artwork's own style when you add or replace something: the same stroke width and line caps, the same corner rounding, the same palette and level of detail. New parts must look drawn by the same hand.
- "Change / swap / replace a part": edit or redraw only that part, in place, at the same size and position unless asked otherwise.
- "Remove": take the part out cleanly; if it covered something, close the gap so nothing looks cut.
- "Extend" (to a wider or taller canvas, or a ratio like 16:9): change the viewBox (and width/height if present) so the original stays whole and centred unless told otherwise, then fill the new area so it continues the artwork naturally: extend backgrounds and patterns, add a few matching shapes. Never stretch or distort the original.
- The whole canvas must stay covered the way the original was: if the original filled its canvas edge to edge, so must the result. No empty or transparent bands, no parts cut off at an edge.
- Repeating artwork (a pattern, a texture, a tiled motif): never copy its shapes by hand. Put one tile in <defs> as a <pattern> with patternUnits="userSpaceOnUse" and the tile's exact width and height (read them from the repeat in the original), then fill a <rect> that covers the whole viewBox with it. This repeats it precisely, with no gaps, overlaps or half tiles that look wrong.
- Keep backgrounds unless asked: a solid backdrop behind the artwork stays, extended to the new canvas.
- Colors: when asked for a color by name, choose a tasteful shade that fits the palette.

Rules for the SVG:
- One standalone <svg> with xmlns="http://www.w3.org/2000/svg" and a viewBox.
- No <script>, no <foreignObject>, no event attributes (onclick...), no external links, images or fonts. Paths, basic shapes, groups, gradients and clip paths are fine.
- Keep it compact: reuse the original's structure; don't add comments.
- If the instruction can't be done on this artwork, return the SVG unchanged and say why in the summary.

When a picture of the SVG comes with it, use it to see the layout, the repeat and what's background; the code is still what you edit.`;

// what may never reach the page: scripts, foreign content, event handlers,
// links to outside files
function clean(svg: string) {
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return reply({}, 200, origin);
  const started = Date.now();
  const tally = newTally();
  let who = null;
  let instruction = "";
  try {
    who = await whoIs(req);
    if (!who) return reply({ error: "sign_in_required" }, 401, origin);
    if (!who.isAdmin) return reply({ error: "not_open" }, 403, origin);

    const body = await req.json();
    instruction = String(body?.instruction ?? "").trim().slice(0, MAX_INSTRUCTION);
    const svg = clean(String(body?.svg ?? "")).trim();
    const image = typeof body?.image === "string" && /^iVBOR/.test(body.image) && body.image.length <= MAX_IMAGE ? body.image : null;
    if (!instruction) return reply({ error: "empty_instruction" }, 400, origin);
    if (!/^<\?xml[\s\S]*?<svg|^<svg/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return reply({ error: "not_svg" }, 400, origin);
    if (svg.length > MAX_IN) return reply({ error: "too_big" }, 413, origin);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return reply({ error: "not_configured", detail: "ANTHROPIC_API_KEY is not set in the function secrets." }, 503, origin);
    const client = new Anthropic({ apiKey: key });

    const model = modelFor("AI_SVG_MODEL", SONNET);
    const text = `INSTRUCTION\n${instruction}\n\nSVG\n${svg}`;
    const message = image
      ? [{ type: "image", source: { type: "base64", media_type: "image/png", data: image } }, { type: "text", text: `The picture above is this SVG as it looks now.\n\n${text}` }]
      : text;
    const answer = await askJson(client, { model, effort: "medium", system: SYSTEM, message, schema: SCHEMA }, tally);

    const out = clean(String(answer?.svg ?? "")).trim();
    if (!/<svg[\s>]/i.test(out) || !/<\/svg>\s*$/i.test(out) || out.length > MAX_OUT) {
      throw Object.assign(new Error("bad svg"), { code: "bad_svg" });
    }
    const summary = String(answer?.summary ?? "").slice(0, 300);

    const id = await logGeneration(
      { user_id: who.userId, kind: "svg_edit", prompt: instruction, brief: { chars: svg.length, image: Boolean(image), fix: Boolean(body?.fix) }, result: { summary, svg: out } },
      tally,
      started,
    );
    return reply({ id, svg: out, summary, usage: usageOf(tally, started) }, 200, origin);
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const code = (e as any)?.code;
    if (who?.isAdmin) {
      await logGeneration({ user_id: who.userId, kind: "svg_edit", prompt: instruction || "svg edit", status: code === "refused" ? "refused" : "failed" }, tally, started);
    }
    if (code) return reply({ error: code }, code === "refused" ? 422 : 502, origin);
    return reply({ error: "failed", detail: who?.isAdmin ? String((e as Error)?.message ?? e) : undefined }, 500, origin);
  }
});
