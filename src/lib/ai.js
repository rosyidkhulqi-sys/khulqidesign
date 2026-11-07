// The one door to AI for the whole site. Every AI button calls a function
// here; nothing else talks to an AI service.
//
// The browser never holds an AI key. Calls go to our own backend, which picks
// the provider (Gemini, ChatGPT or Claude) and can switch it without any
// change to the site. Until the backend exists, aiReady is false and the
// buttons show "Coming soon".
//
// To switch it on later, set VITE_AI_ENDPOINT (for example
// https://api.khulqidesign.com/ai) in .env; each task is POST <endpoint>/<task>.

const endpoint = import.meta.env.VITE_AI_ENDPOINT;

export const aiReady = Boolean(endpoint);

export class AiUnavailableError extends Error {
  constructor() {
    super("AI is not available yet.");
    this.name = "AiUnavailableError";
  }
}

async function call(task, input) {
  if (!aiReady) throw new AiUnavailableError();
  const response = await fetch(`${endpoint}/${task}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // the backend reads the signed-in user from the session cookie
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`AI ${task} failed (${response.status})`);
  return response.json();
}

// Library search in plain words ("red outline shopping icons"): the backend
// turns it into keywords and filters, then searches our own assets.
//   -> { keywords: string[], filters: { style?, license?, ... } }
export const aiSearch = (query, library) => call("search", { query, library });

// Title and keywords for an uploaded file, from its preview image.
//   -> { title, description, keywords: string[] }
export const aiTags = (previewUrl, kind) => call("tags", { previewUrl, kind });

// Create: an image or element from a prompt.  -> { url }
export const aiGenerate = (prompt, size) => call("generate", { prompt, size });

// Create: headline or caption ideas.  -> { options: string[] }
export const aiWrite = (prompt, tone) => call("write", { prompt, tone });

// Create: a picture without its background.  -> { url }
export const aiRemoveBackground = (imageUrl) => call("remove-background", { imageUrl });

// Create: color palettes that suit a design.  -> { palettes: string[][] }
export const aiPalette = (colors) => call("palette", { colors });
