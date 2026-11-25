// Create's AI tab (admin trial): an AI vector element and AI text, in the
// ai-create Edge Function. Each use is logged with its cost.
import { supabase } from "./supabaseClient";
import { safeSvg } from "./aiSvg";

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

// -> { svg, title, usage }
export async function createElement(prompt) {
  const data = await call({ mode: "element", prompt });
  const svg = safeSvg(data.svg);
  if (!svg) throw new Error(MESSAGES.bad_svg);
  return { ...data, svg };
}

// -> { options: [4 strings], usage }; kind: "headline" or "caption"
export const writeText = (prompt, tone, kind) => call({ mode: "text", prompt, tone, kind });
