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

// brief: { format, style, colors, content } (see pages/ai/TemplateBrief.jsx)
// -> { id, template: { title, scene }, usage, checks }
export async function generateTemplate(prompt, brief) {
  const { data, error } = await supabase.functions.invoke("ai-template", { body: { prompt, brief } });
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

// ---------------------------------------------------------- the brief

export const BRIEF_FIELDS = [
  ["headline", "Headline", "Seminar Nasional AI 2026"],
  ["subheadline", "Subheadline", "Peluang dan etika di dunia kerja"],
  ["date", "Date", "Sabtu, 12 Desember 2026"],
  ["time", "Time", "09.00 – 12.00 WIB"],
  ["place", "Place", "Aula Utama, Gedung Rektorat"],
  ["speakers", "Speakers", "Dr. Rina Kusuma, Prof. Adi Pratama"],
  ["price", "Price / offer", "Gratis untuk mahasiswa"],
  ["cta", "Button", "Daftar sekarang"],
  ["contact", "Contact / link", "bit.ly/seminar-ai"],
  ["organizer", "Organizer", "Fakultas Ilmu Komputer"],
  ["logo", "Logo spot", null],
];

export const emptyBrief = { format: "auto", style: "auto", colors: [], content: {} };

// the brief as the function reads it
export const briefPayload = (brief) => ({
  format: brief.format === "auto" ? undefined : brief.format,
  style: brief.style === "auto" ? undefined : brief.style,
  colors: brief.colors,
  content: Object.entries(brief.content).map(([field, text]) => ({ field, text })),
});

// AI resize: { from, to, pages: [{ elements }] } -> { id, pages: [{ elements: [{ id, x, y, w, fontSize }] }], usage }
export async function aiResizeLayout(body) {
  const { data, error } = await supabase.functions.invoke("ai-resize", { body });
  if (error) {
    let code, detail;
    try {
      ({ error: code, detail } = await error.context.json());
    } catch {
      /* not a JSON body */
    }
    throw new Error(MESSAGES[code] ?? detail ?? "The AI couldn't rearrange this design. It was resized without AI.");
  }
  return data;
}
