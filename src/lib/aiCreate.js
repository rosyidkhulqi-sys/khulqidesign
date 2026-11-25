// Create's AI tab (admin trial): an AI vector element and AI text, in the
// ai-create Edge Function. Each use is logged with its cost.
import { supabase } from "./supabaseClient";
import { drawSvg, safeSvg } from "./aiSvg";

const MESSAGES = {
  sign_in_required: "Log in first.",
  not_open: "These AI tools are only open to admins while they're tried out.",
  empty_prompt: "Describe what you want first.",
  refused: "This can't be made. Try describing it differently.",
  too_long: "The result came out too long. Try a simpler description.",
  bad_svg: "The AI didn't send back a valid drawing. Try again.",
  bad_answer: "No text came back. Try again.",
};

async function call(body) {
  const { data, error } = await supabase.functions.invoke("ai-create", { body });
  if (error) {
    let code, detail;
    try {
      ({ error: code, detail } = await error.context.json());
    } catch {
      /* not a JSON body */
    }
    throw new Error(MESSAGES[code] ?? detail ?? "That didn't work. Please try again.");
  }
  return data;
}

// The drawing cut to what's actually drawn: the empty margin around it is
// taken off the viewBox (measured from the drawn pixels), so its selection
// box fits the object, as the library's elements do.
async function trimSvg(svg) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.querySelector("svg");
  const vb = (root?.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  // shapes that draw nothing (no fill and no stroke, zero size, fully
  // transparent) still widen the editor's selection box: take them out
  const none = (v) => v == null ? false : /^(none|transparent)$/i.test(v.trim()) || /^0(\.0*)?$/.test(v.trim());
  const paint = (el, prop) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
      const v = n.getAttribute(prop) ?? n.style?.getPropertyValue(prop);
      if (v) return v;
    }
    return null;
  };
  root.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon").forEach((el) => {
    const zero = ["rx", "ry", "r", "width", "height"].some((a) => el.hasAttribute(a) && Number(el.getAttribute(a)) === 0);
    const fill = paint(el, "fill");
    const stroke = paint(el, "stroke");
    const noFill = none(fill) || (fill === null && el.tagName === "line");
    const noStroke = stroke === null || none(stroke) || none(paint(el, "stroke-width"));
    if (zero || (noFill && noStroke) || none(paint(el, "opacity"))) el.remove();
  });
  svg = new XMLSerializer().serializeToString(root);
  const { bands } = await drawSvg(svg, 1024);
  if (Math.max(bands.left + bands.right, bands.top + bands.bottom) >= 0.98) return svg;
  // a hair of room so antialiased edges aren't clipped
  const pad = 0.004;
  const x = vb[0] + vb[2] * Math.max(0, bands.left - pad);
  const y = vb[1] + vb[3] * Math.max(0, bands.top - pad);
  const w = vb[2] * Math.min(1, 1 - bands.left - bands.right + pad * 2);
  const h = vb[3] * Math.min(1, 1 - bands.top - bands.bottom + pad * 2);
  root.setAttribute("viewBox", [x, y, w, h].map((n) => Math.round(n * 10) / 10).join(" "));
  root.removeAttribute("width");
  root.removeAttribute("height");
  return new XMLSerializer().serializeToString(root);
}

// -> { svg, title, usage }
export async function createElement(prompt) {
  const data = await call({ mode: "element", prompt });
  const svg = safeSvg(data.svg);
  if (!svg) throw new Error(MESSAGES.bad_svg);
  return { ...data, svg: await trimSvg(svg).catch(() => svg) };
}

// -> { options: [4 strings], usage }; kind: "headline" or "caption"
export const writeText = (prompt, tone, kind) => call({ mode: "text", prompt, tone, kind });

const STOP = new Set(["a", "an", "the", "and", "or", "with", "of", "in", "on", "for", "to", "create", "draw", "make", "flat", "illustration", "vector", "style", "cute", "colors", "colours", "warm", "cool"]);

// An AI element kept as a Create element (admin), so what was paid for once
// is used by everyone after: an SVG in the AI elements batch, marked AI-made.
export async function saveAiElement({ svg, title, prompt }) {
  const [{ publishElement }, { openBatch, allowAddingTo }] = await Promise.all([
    import("../pages/admin/elementPublish"),
    import("../pages/admin/batches"),
  ]);
  const vb = (new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("svg")?.getAttribute("viewBox") || "0 0 512 512")
    .split(/[\s,]+/).map(Number);
  const words = `${title} ${prompt}`.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.has(w));
  allowAddingTo("element", "EL AI elements");
  const batchId = await openBatch("element", "EL AI elements");
  return publishElement({
    format: "SVG",
    file: new Blob([svg], { type: "image/svg+xml" }),
    width: Math.round(vb[2]) || 512,
    height: Math.round(vb[3]) || 512,
    base: title,
    title,
    keywords: [...new Set(words)].slice(0, 20),
    category: "graphics",
    kind: "element",
    license: "premium",
    aiGenerated: true,
    batchId,
  }, () => {});
}
