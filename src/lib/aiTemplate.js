// Template from text: sends the description to our ai-template function,
// which asks Claude for an editable design. The browser never holds an AI key.
import { supabase } from "./supabaseClient";

const MESSAGES = {
  sign_in_required: "Log in to generate a design.",
  not_open: "Template from text isn't open yet.",
  empty_prompt: "Describe the design you want first.",
  refused: "This request can't be designed. Try describing it differently.",
  too_long: "The design came out too long. Try a shorter description.",
  empty_design: "The design came back empty. Try again.",
};

// -> { template: { title, scene }, usage }
export async function generateTemplate(prompt) {
  const { data, error } = await supabase.functions.invoke("ai-template", { body: { prompt } });
  if (error) {
    let code, detail;
    try {
      ({ error: code, detail } = await error.context.json());
    } catch {
      /* not a JSON body */
    }
    // detail only ever reaches admins
    throw new Error(MESSAGES[code] ?? detail ?? "The design couldn't be made. Please try again.");
  }
  return data;
}
