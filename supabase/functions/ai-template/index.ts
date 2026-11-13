// Template from text: a short description in, an editable Create design out.
//
// POST { prompt: string } -> { template: { title, scene } }
//
// Claude lays the design out as the same scene data our built-in templates use
// (shapes and text on one artboard), so Create opens it like any template and
// every part stays editable. The answer is held to a JSON schema, and then
// checked again here (sizes, colors, fonts, counts) before it leaves.
//
// While this is being tried out only admins get through, so nobody else
// spends the API credit. ANTHROPIC_API_KEY lives in the function's secrets.
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";

const ALLOWED_ORIGINS = [
  "https://khulqidesign.com",
  "https://www.khulqidesign.com",
  "http://localhost:5173",
];
const PUBLISHABLE_KEY = "sb_publishable_IxJSv34yZhNyGkgWbvYAjg_UFmo6CDO";
const MODEL = "claude-opus-5-5";
const MAX_PROMPT = 600;
const MAX_ELEMENTS = 40;

// the formats Create offers, so a design opens at a size people know
const FORMATS = [
  { label: "Instagram Post", w: 1080, h: 1080 },
  { label: "Instagram Portrait", w: 1080, h: 1350 },
  { label: "Story / Reels", w: 1080, h: 1920 },
  { label: "YouTube Thumbnail", w: 1280, h: 720 },
  { label: "Presentation", w: 1920, h: 1080 },
  { label: "A4 Portrait", w: 1240, h: 1754 },
  { label: "Business Card", w: 1050, h: 600 },
];

// Google Fonts Create loads (all SIL Open Font License)
const FONTS = [
  "Space Grotesk", "DM Sans", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat",
  "Poppins", "Raleway", "Nunito", "Work Sans", "Rubik", "Manrope", "Outfit",
  "Plus Jakarta Sans", "Figtree", "Karla", "Mulish", "Barlow", "Oswald", "Archivo", "Quicksand",
  "Instrument Serif", "Playfair Display", "Merriweather", "Lora", "PT Serif",
  "Libre Baskerville", "Cormorant Garamond", "EB Garamond", "DM Serif Display", "Crimson Text", "Bitter",
  "Bebas Neue", "Anton", "Abril Fatface", "Alfa Slab One", "Lobster", "Righteous", "Bungee",
  "Fredoka", "Archivo Black", "Titan One", "Staatliches", "Comfortaa", "Baloo 2",
  "Pacifico", "Dancing Script", "Great Vibes", "Sacramento", "Caveat", "Kaushan Script",
  "Shadows Into Light", "Amatic SC", "Parisienne", "Allura",
  "Roboto Mono", "JetBrains Mono", "Space Mono", "IBM Plex Mono", "Courier Prime",
];

const num = { type: "number" };
const color = { type: "string", description: "Hex color, #rrggbb" };

// one flat element shape per kind; every field is filled, so the schema stays strict
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "format", "bg", "elements"],
  properties: {
    title: { type: "string", description: "Short name for the design, 2-5 words, in the user's language" },
    format: { type: "string", enum: FORMATS.map((f) => f.label) },
    bg: color,
    elements: {
      type: "array",
      description: "Drawn in order: the first is at the back",
      items: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "x", "y", "w", "h", "r", "fill", "opacity", "angle", "stroke", "strokeWidth"],
            properties: {
              type: { const: "rect" },
              x: num, y: num, w: num, h: num,
              r: { type: "number", description: "Corner radius" },
              fill: { type: "string", description: "Hex color, or \"none\" for an outline only" },
              opacity: { type: "number", description: "0 to 1" },
              angle: { type: "number", description: "Degrees, turning around the top-left corner" },
              stroke: color,
              strokeWidth: { type: "number", description: "0 for no outline" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "x", "y", "r", "fill", "opacity", "stroke", "strokeWidth"],
            properties: {
              type: { const: "circle" },
              x: { type: "number", description: "Left edge of the circle's box (center is x + r)" },
              y: { type: "number", description: "Top edge of the circle's box (center is y + r)" },
              r: { type: "number", description: "Radius" },
              fill: { type: "string", description: "Hex color, or \"none\" for an outline only" },
              opacity: num,
              stroke: color,
              strokeWidth: num,
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "x", "y", "w", "text", "font", "size", "weight", "italic", "fill", "align", "lineHeight", "letterSpacing", "opacity", "angle"],
            properties: {
              type: { const: "text" },
              x: num, y: num,
              w: { type: "number", description: "Box width; the text wraps inside it" },
              text: { type: "string", description: "Use \\n for a line break" },
              font: { type: "string", enum: FONTS },
              size: { type: "number", description: "Font size in px" },
              weight: { type: "integer", enum: [400, 700] },
              italic: { type: "boolean" },
              fill: color,
              align: { type: "string", enum: ["left", "center", "right"] },
              lineHeight: { type: "number", description: "1.0 to 1.6; about 1.0-1.1 for big headings" },
              letterSpacing: { type: "number", description: "Extra space between letters in px, 0 for none" },
              opacity: num,
              angle: num,
            },
          },
        ],
      },
    },
  },
};

const SYSTEM = `You are the senior graphic designer behind Khulqidesign, a design platform for designers and institutions (schools, campuses, offices, agencies). You turn a short request into one finished, editable design.

The design is built only from rectangles, circles and text on one artboard; there are no photos or icons. Make that a strength: confident typography, a clear grid, bold geometric shapes and a deliberate palette, the way a good Swiss or editorial poster works.

Quality bar (this is what people judge you on):
- One clear focal point: a large headline. Then a clear hierarchy: headline, a supporting line, small details (date, place, contact), and one call to action when the request is promotional.
- Write the copy yourself, short and specific to the request, in the language the user wrote in. Never use lorem ipsum or placeholders like "Your text here". Invent plausible details (a date, a venue, a handle) only when the format needs them, and keep them modest.
- A palette of 2-4 colors with strong contrast between text and what sits behind it. Fit the mood: an institution or formal event looks calm and trustworthy; a sale looks energetic.
- At most two font families: one for headings, one for body. Script fonts only for a word or two.
- Generous margins: keep text at least 6% of the artboard width from every edge. Align things to shared left edges or to the center; avoid random positions.
- Shapes support the text (blocks behind text, bands, circles cropped by the edge for movement). Shapes may run off the artboard edge; text may not.
- 6 to 25 elements. Fewer, well placed elements beat clutter.

Geometry (the editor's coordinate system):
- Pixels, origin at the top-left of the artboard, x to the right, y down. x/y is an element's top-left corner.
- A circle's box starts at x/y; its center is (x + r, y + r).
- Text wraps inside its box width w. Its height is about lines x size x lineHeight. Estimate the width of a line as characters x size x 0.55 for most sans fonts (0.45 for condensed fonts like Bebas Neue, Anton, Oswald; 0.6 for wide ones); choose w and size so lines break where you intend, and leave room so blocks never overlap.
- Text centered on the artboard: set x to the margin, w to artboard width minus both margins, align "center".
- Elements are drawn in order; put backgrounds and shapes first, text last.
- Use opacity below 1 sparingly, for depth. Leave angle at 0 unless a tilt is part of the idea.

Pick the format that fits the request (a "poster" or "flyer" is A4 Portrait; a "post" is Instagram Post; a "story" is Story / Reels; "slide" or "presentation" is Presentation). If the user names one, use it.`;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------- the safety net

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown, fallback: string) => {
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  return HEX.test(s) ? s.toLowerCase() : fallback;
};
const n = (v: unknown, lo: number, hi: number, fallback = 0) => {
  const x = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.round(Math.min(hi, Math.max(lo, x)) * 100) / 100;
};

// Whatever came back, only known kinds, sane numbers and real colors and
// fonts reach the editor.
// deno-lint-ignore no-explicit-any
function clean(raw: any) {
  const format = FORMATS.find((f) => f.label === raw?.format) ?? FORMATS[0];
  const { w: W, h: H } = format;
  const big = Math.max(W, H);
  const elements = [];
  for (const el of Array.isArray(raw?.elements) ? raw.elements.slice(0, MAX_ELEMENTS) : []) {
    const common = {
      x: n(el.x, -W, W * 2),
      y: n(el.y, -H, H * 2),
      opacity: n(el.opacity, 0, 1, 1),
    };
    const paint = el.fill === "none" ? "transparent" : hex(el.fill, "#000000");
    const outline = { stroke: hex(el.stroke, "#000000"), strokeWidth: n(el.strokeWidth, 0, 80) };
    if (el.type === "rect") {
      elements.push({ type: "rect", ...common, w: n(el.w, 1, big * 2, 100), h: n(el.h, 1, big * 2, 100), r: n(el.r, 0, big), fill: paint, angle: n(el.angle, -360, 360), ...outline });
    } else if (el.type === "circle") {
      elements.push({ type: "circle", ...common, r: n(el.r, 1, big * 2, 50), fill: paint, ...outline });
    } else if (el.type === "text" && typeof el.text === "string" && el.text.trim()) {
      elements.push({
        type: "text",
        ...common,
        w: n(el.w, 20, W * 1.2, W * 0.8),
        text: el.text.slice(0, 400),
        font: FONTS.includes(el.font) ? el.font : "DM Sans",
        size: n(el.size, 8, 600, 40),
        weight: el.weight === 700 ? 700 : 400,
        italic: el.italic === true,
        fill: hex(el.fill, "#111111"),
        align: ["left", "center", "right"].includes(el.align) ? el.align : "left",
        lineHeight: n(el.lineHeight, 0.8, 2, 1.16),
        letterSpacing: n(el.letterSpacing, -20, 60),
        angle: n(el.angle, -360, 360),
      });
    }
  }
  const title = typeof raw?.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 60) : "AI design";
  return { title, scene: { w: W, h: H, bg: hex(raw?.bg, "#ffffff"), elements } };
}

// ---------------------------------------------------------- the request

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405, origin);

  let isAdmin = false;
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || token.startsWith("sb_")) return reply({ error: "sign_in_required" }, 401, origin);

    const base = Deno.env.get("SUPABASE_URL")!;
    const asUser = { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
    const userRes = await fetch(`${base}/auth/v1/user`, { headers: asUser });
    if (!userRes.ok) return reply({ error: "sign_in_required" }, 401, origin);

    const adminRes = await fetch(`${base}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: { ...asUser, "Content-Type": "application/json" },
      body: "{}",
    });
    isAdmin = adminRes.ok && (await adminRes.json()) === true;
    // trial: admins only, until credits are in place
    if (!isAdmin) return reply({ error: "not_open" }, 403, origin);

    const { prompt } = await req.json();
    const text = typeof prompt === "string" ? prompt.trim().slice(0, MAX_PROMPT) : "";
    if (!text) return reply({ error: "empty_prompt" }, 400, origin);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return reply({ error: "not_configured", detail: "ANTHROPIC_API_KEY is not set in the function secrets." }, 503, origin);

    const client = new Anthropic({ apiKey: key });
    const started = Date.now();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // a declined request is retried on the fallback model the API picks
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Design this: ${text}` }],
      // deno-lint-ignore no-explicit-any
    } as any);

    if (response.stop_reason === "refusal") return reply({ error: "refused" }, 422, origin);
    if (response.stop_reason === "max_tokens") return reply({ error: "too_long" }, 502, origin);

    // deno-lint-ignore no-explicit-any
    const out = (response.content as any[]).find((b) => b.type === "text")?.text ?? "";
    const template = clean(JSON.parse(out));
    if (template.scene.elements.length === 0) return reply({ error: "empty_design" }, 502, origin);

    const u = response.usage;
    return reply({
      template,
      // for the trial: what one design cost and how long it took
      usage: {
        model: response.model,
        input: u.input_tokens,
        cached: u.cache_read_input_tokens ?? 0,
        output: u.output_tokens,
        seconds: Math.round((Date.now() - started) / 100) / 10,
      },
    }, 200, origin);
  } catch (e) {
    const status = e instanceof Anthropic.RateLimitError ? 429 : 500;
    return reply({ error: "failed", detail: isAdmin ? String((e as Error)?.message ?? e) : undefined }, status, origin);
  }
});
