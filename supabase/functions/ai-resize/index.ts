// AI resize: re-lays an existing design out for a new format.
//
// POST { from: { w, h }, to: { w, h, label? }, pages: [{ elements: [...] }] }
//   each element: { id, kind: "text" | "shape" | "image" | "group", x, y, w, h,
//                   angle, text?, fontSize? }   (boxes in the old format)
//   -> { id, pages: [{ elements: [{ id, x, y, w, fontSize }] }], usage }
//
// Claude never sees or changes what the elements are; it only places them
// again: a new top-left corner and width for each (and a font size for text),
// in the new format. The browser applies that to the real objects, so
// pictures, icons and groups stay exactly as they were. Backgrounds (things
// covering the whole page) are left out: the browser stretches those itself.
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { addUsage, logGeneration, MODEL, newTally, reply, usageOf, whoIs } from "../_shared/ai.ts";

const MAX_PAGES = 30;
const MAX_ELEMENTS = 60;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pages"],
  properties: {
    pages: {
      type: "array",
      description: "One entry per page, in the same order as given",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["elements"],
        properties: {
          elements: {
            type: "array",
            description: "Every element of the page, by its id",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "x", "y", "w", "fontSize"],
              properties: {
                id: { type: "integer" },
                x: { type: "number", description: "New left edge of the element's box, in the new format" },
                y: { type: "number", description: "New top edge of the element's box" },
                w: { type: "number", description: "New width of the box. Pictures, icons and shapes keep their proportions, so the height follows" },
                fontSize: {
                  anyOf: [{ type: "number" }, { type: "null" }],
                  description: "Text only: the new font size in px; the text wraps inside w. null for everything else",
                },
              },
            },
          },
        },
      },
    },
  },
};

const SYSTEM = `You are a senior graphic designer adapting a finished design to a new format, the way a studio turns one campaign into a post, a story, a slide and a poster.

You get each page's elements with their boxes in the old format, and the new format's size. Return a new box for every element so the page works in the new format:
- Keep every element and its role. Never drop, merge or invent elements; you only move and resize them.
- Keep the hierarchy: the headline stays the most prominent, details stay smaller. Keep reading order.
- Use the new shape. A tall format stacks things vertically and uses the full height; a wide format can place text beside a picture. Don't just shrink the old layout into the middle.
- Keep text at least 6% of the width from every edge. Nothing important may run off the page; decorative shapes may bleed off an edge if they did before.
- Keep relationships: text that sat on a shape (a button, a band, a card) stays inside that shape, with the same padding feel; things that were aligned stay aligned.
- Pictures, icons and shapes keep their proportions: give the new width only; the height follows (new height = w x old h / old w).
- Text: give the box width w and a font size. A line holds about w / (fontSize x 0.55) characters; height is about lines x fontSize x 1.2. Make sure text boxes don't collide.
- Size text for the new format: a headline on a 1920 px tall story can be larger than on a 1080 px post; on a small business card it must be smaller.`;

// deno-lint-ignore no-explicit-any
const num = (v: any, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return reply("ok", 200, origin);
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405, origin);

  const started = Date.now();
  const tally = newTally();
  let who: Awaited<ReturnType<typeof whoIs>> = null;
  let summary = "";
  try {
    who = await whoIs(req);
    if (!who) return reply({ error: "sign_in_required" }, 401, origin);
    if (!who.isAdmin) return reply({ error: "not_open" }, 403, origin);

    const body = await req.json();
    const from = { w: num(body?.from?.w, 16, 8000, 0), h: num(body?.from?.h, 16, 8000, 0) };
    const to = { w: num(body?.to?.w, 16, 8000, 0), h: num(body?.to?.h, 16, 8000, 0) };
    if (!from.w || !to.w || !Array.isArray(body?.pages) || !body.pages.length) return reply({ error: "bad_request" }, 400, origin);

    // only what's needed reaches the model: ids, kinds, boxes, text
    // deno-lint-ignore no-explicit-any
    const pages = body.pages.slice(0, MAX_PAGES).map((p: any) =>
      (Array.isArray(p?.elements) ? p.elements.slice(0, MAX_ELEMENTS) : [])
        // deno-lint-ignore no-explicit-any
        .filter((e: any) => Number.isInteger(e?.id))
        // deno-lint-ignore no-explicit-any
        .map((e: any) => ({
          id: e.id,
          kind: ["text", "shape", "image", "group"].includes(e.kind) ? e.kind : "shape",
          x: Math.round(num(e.x, -from.w, from.w * 2, 0)),
          y: Math.round(num(e.y, -from.h, from.h * 2, 0)),
          w: Math.round(num(e.w, 1, from.w * 3, 10)),
          h: Math.round(num(e.h, 1, from.h * 3, 10)),
          ...(e.angle ? { angle: Math.round(num(e.angle, -360, 360, 0)) } : {}),
          ...(e.kind === "text" ? { text: String(e.text ?? "").slice(0, 300), fontSize: Math.round(num(e.fontSize, 4, 800, 40)) } : {}),
        }))
    );
    summary = `${from.w}x${from.h} -> ${to.w}x${to.h}${body?.to?.label ? ` (${String(body.to.label).slice(0, 40)})` : ""}, ${pages.length} page(s)`;

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return reply({ error: "not_configured", detail: "ANTHROPIC_API_KEY is not set in the function secrets." }, 503, origin);
    const client = new Anthropic({ apiKey: key });

    const message = `Old format: ${from.w} x ${from.h} px. New format: ${to.w} x ${to.h} px.\n\n`
      + pages.map((els: unknown[], i: number) => `PAGE ${i + 1}\n${JSON.stringify(els)}`).join("\n\n");
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: message }],
      // deno-lint-ignore no-explicit-any
    } as any);
    addUsage(tally, response);
    if (response.stop_reason === "refusal") throw Object.assign(new Error("refused"), { code: "refused" });
    if (response.stop_reason === "max_tokens") throw Object.assign(new Error("too long"), { code: "too_long" });
    // deno-lint-ignore no-explicit-any
    const raw = JSON.parse((response.content as any[]).find((b) => b.type === "text")?.text ?? "{}");

    // only ids that were sent, with sane numbers, go back
    // deno-lint-ignore no-explicit-any
    const layout = pages.map((els: any[], i: number) => {
      const asked = new Map(els.map((e) => [e.id, e]));
      // deno-lint-ignore no-explicit-any
      const got = Array.isArray(raw?.pages?.[i]?.elements) ? raw.pages[i].elements : [];
      return {
        elements: got
          // deno-lint-ignore no-explicit-any
          .filter((e: any) => asked.has(e?.id))
          // deno-lint-ignore no-explicit-any
          .map((e: any) => ({
            id: e.id,
            x: num(e.x, -to.w, to.w * 2, 0),
            y: num(e.y, -to.h, to.h * 2, 0),
            w: num(e.w, 1, to.w * 3, asked.get(e.id).w),
            fontSize: asked.get(e.id).kind === "text" ? num(e.fontSize, 4, 800, asked.get(e.id).fontSize) : null,
          })),
      };
    });

    const id = await logGeneration(
      { user_id: who.userId, kind: "resize", prompt: summary, brief: { from, to }, result: { pages: layout } },
      tally,
      started,
    );
    return reply({ id, pages: layout, usage: usageOf(tally, started) }, 200, origin);
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const code = (e as any)?.code;
    if (who?.isAdmin) {
      await logGeneration({ user_id: who.userId, kind: "resize", prompt: summary || "resize", status: code === "refused" ? "refused" : "failed" }, tally, started);
    }
    if (code) return reply({ error: code }, code === "refused" ? 422 : 502, origin);
    return reply({ error: "failed", detail: who?.isAdmin ? String((e as Error)?.message ?? e) : undefined }, 500, origin);
  }
});
