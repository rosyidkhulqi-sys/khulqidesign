// Edit an image, step two (admin trial): Claude edits an SVG as asked, in
// the ai-svg-edit Edge Function.
import { supabase } from "./supabaseClient";

const MESSAGES = {
  sign_in_required: "Log in first.",
  not_open: "AI editing is only open to admins while it's tried out.",
  empty_instruction: "Say what to change first.",
  not_svg: "This file isn't an SVG.",
  too_big: "This SVG is too big for AI editing (50,000 characters at most). Try a simpler one.",
  refused: "This change can't be made. Try saying it differently.",
  too_long: "The edited SVG came out too long. Try a simpler SVG or a smaller change.",
  bad_svg: "The AI didn't send back a valid SVG. Try again.",
};

// -> { id, svg, summary, usage }; image: the SVG drawn as PNG (base64), fix:
// this is a second pass over a first result
export async function editSvg(svg, instruction, { image = null, fix = false } = {}) {
  const { data, error } = await supabase.functions.invoke("ai-svg-edit", { body: { svg, instruction, image, fix } });
  if (error) {
    let code, detail;
    try {
      ({ error: code, detail } = await error.context.json());
    } catch {
      /* not a JSON body */
    }
    throw new Error(MESSAGES[code] ?? detail ?? "The SVG couldn't be edited. Please try again.");
  }
  return data;
}

// an SVG made safe to show: scripts, foreign content, event handlers and
// outside links removed (the server does the same; this is the second net)
export function safeSvg(text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) return null;
  svg.querySelectorAll("script, foreignObject").forEach((n) => n.remove());
  svg.querySelectorAll("*").forEach((n) =>
    [...n.attributes].forEach((a) => {
      if (/^on/i.test(a.name)) n.removeAttribute(a.name);
      if (/href$/i.test(a.name) && !a.value.startsWith("#")) n.removeAttribute(a.name);
    }));
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(svg);
}

// The SVG drawn on a canvas: a PNG for Claude to look at (base64, no data:
// prefix), and how much of each edge is empty, as a share of the side.
export async function drawSvg(svgText, maxSide = 768) {
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml").querySelector("svg");
    const vb = (doc?.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    const ratio = vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? vb[2] / vb[3] : (img.naturalWidth || 1) / (img.naturalHeight || 1);
    const w = ratio >= 1 ? maxSide : Math.round(maxSide * ratio);
    const h = ratio >= 1 ? Math.round(maxSide / ratio) : maxSide;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const clear = (x, y) => data[(y * w + x) * 4 + 3] < 8;
    // a row or column counts as empty when nearly all of it is clear
    const rowEmpty = (y) => { let n = 0; for (let x = 0; x < w; x++) n += clear(x, y); return n / w > 0.98; };
    const colEmpty = (x) => { let n = 0; for (let y = 0; y < h; y++) n += clear(x, y); return n / h > 0.98; };
    const run = (count, test) => { let i = 0; while (i < count && test(i)) i++; return i; };
    let empty = 0;
    for (let i = 3; i < data.length; i += 4) empty += data[i] < 8;
    const bands = {
      top: run(h, (i) => rowEmpty(i)) / h,
      bottom: run(h, (i) => rowEmpty(h - 1 - i)) / h,
      left: run(w, (i) => colEmpty(i)) / w,
      right: run(w, (i) => colEmpty(w - 1 - i)) / w,
    };
    const png = canvas.toDataURL("image/png").split(",")[1];
    return { png, bands, empty: empty / (w * h) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// problems a result has that the original didn't, in plain words for a fix
export function problemsOf(before, after) {
  const found = [];
  for (const side of ["top", "bottom", "left", "right"]) {
    if (after.bands[side] > 0.03 && before.bands[side] < 0.01) {
      found.push(`the ${side} ${Math.round(after.bands[side] * 100)}% of the canvas is empty (transparent); fill it the way the rest is filled`);
    }
  }
  if (!found.length && before.empty < 0.02 && after.empty > 0.08) {
    found.push(`${Math.round(after.empty * 100)}% of the canvas is empty (transparent) where the original was fully covered; cover it`);
  }
  if (after.empty > 0.97) found.push("the result is almost entirely empty");
  return found;
}
