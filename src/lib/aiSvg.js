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

// -> { id, svg, summary, usage }
export async function editSvg(svg, instruction) {
  const { data, error } = await supabase.functions.invoke("ai-svg-edit", { body: { svg, instruction } });
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
