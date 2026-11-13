// What Claude is asked for and how its answer is checked: the formats and
// fonts Create knows, the brief, the JSON schema, the design rules, a
// cleanup pass and a layout check (text that collides, runs off the page, or
// leaves a big part of it empty).

export const FORMATS = [
  { label: "Instagram Post", w: 1080, h: 1080 },
  { label: "Instagram Portrait", w: 1080, h: 1350 },
  { label: "Story / Reels", w: 1080, h: 1920 },
  { label: "YouTube Thumbnail", w: 1280, h: 720 },
  { label: "Presentation", w: 1920, h: 1080 },
  { label: "A4 Portrait", w: 1240, h: 1754 },
  { label: "Business Card", w: 1050, h: 600 },
];

// Google Fonts Create loads (all SIL Open Font License)
export const FONTS = [
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

// how wide a character is, as a share of the font size
const NARROW = ["Bebas Neue", "Anton", "Oswald", "Staatliches", "Amatic SC", "Barlow"];
const WIDE = ["Archivo Black", "Alfa Slab One", "Bungee", "Titan One", "Righteous", "Space Mono",
  "Roboto Mono", "JetBrains Mono", "IBM Plex Mono", "Courier Prime", "Abril Fatface"];
const charWidth = (font: string, weight: number) =>
  (NARROW.includes(font) ? 0.44 : WIDE.includes(font) ? 0.64 : 0.55) + (weight === 700 ? 0.03 : 0);

// ---------------------------------------------------------- the brief

export const STYLES: Record<string, string> = {
  minimal: "Minimal: lots of white space, one strong headline, a single accent color, thin rules, restrained type.",
  bold: "Bold: oversized condensed or heavy headline, high contrast, big color blocks, energetic.",
  elegant: "Elegant: serif display type, refined spacing, muted or deep palette with a metallic-like accent, symmetric and calm.",
  corporate: "Corporate / institutional: trustworthy and orderly, a clear grid, a navy, green or maroon base, sans-serif type, formal tone.",
  playful: "Playful: rounded friendly fonts, bright cheerful colors, circles and soft shapes, a light tone.",
  editorial: "Editorial: magazine-like, a large serif headline, columns, numbered details, thin lines, black, white and one accent.",
};

export const FIELDS: Record<string, string> = {
  headline: "Headline",
  subheadline: "Subheadline",
  date: "Date",
  time: "Time",
  place: "Place / venue",
  speakers: "Speakers / guests",
  price: "Price / offer",
  cta: "Call to action button",
  contact: "Contact / link / social handle",
  organizer: "Organizer",
  logo: "Logo spot",
};

export type Brief = {
  format?: string;
  style?: string;
  colors?: string[];
  content?: { field: string; text?: string }[];
};

// the brief as plain instructions for the designer
export function briefText(prompt: string, brief: Brief) {
  const lines = [`Request: ${prompt}`];
  const format = FORMATS.find((f) => f.label === brief.format);
  if (format) lines.push(`Format: ${format.label} (${format.w} x ${format.h} px). Use exactly this format.`);
  if (brief.style && STYLES[brief.style]) lines.push(`Style: ${STYLES[brief.style]}`);
  const colors = (brief.colors ?? []).filter((c) => HEX.test(c)).slice(0, 4);
  if (colors.length) lines.push(`Colors: build the palette around ${colors.join(", ")}.`);
  const content = (brief.content ?? []).filter((c) => FIELDS[c.field]);
  if (content.length) {
    lines.push("Must include exactly these parts (and nothing else of this kind):");
    for (const c of content) {
      const given = typeof c.text === "string" && c.text.trim() ? `"${c.text.trim().slice(0, 300)}" (use this text as written)` : "write it yourself";
      lines.push(c.field === "logo"
        ? "- Logo spot: a neat placeholder (a rounded rectangle or circle with the word LOGO) where the organizer's logo will go"
        : `- ${FIELDS[c.field]}: ${given}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------- the schema

const num = { type: "number" };
const color = { type: "string", description: "Hex color, #rrggbb" };

export const SCHEMA = {
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

// ---------------------------------------------------------- the rules

export const SYSTEM = `You are the senior graphic designer behind Khulqidesign, a design platform for designers and institutions (schools, campuses, offices, agencies). You turn a brief into one finished, editable design that a professional would be happy to send out.

The design is built only from rectangles, circles and text on one artboard; there are no photos or icons. Make that a strength: confident typography, a clear grid, bold geometric shapes and a deliberate palette, the way a good Swiss or editorial poster works.

Composition (the most common failure is a design that only fills part of the page; never do that):
- Plan the page in three zones before placing anything. Top zone (first ~20% of the height): kicker, organizer, logo spot. Middle zone (~20-70%): the hero, meaning the headline and the main graphic. Bottom zone (last ~30%): details (date, time, place, speakers), the call to action and contact. Every zone must hold content; the lowest text must end within the last 12% of the height.
- Spread the content over the whole height using a consistent vertical rhythm. No empty band taller than about 18% of the height, unless it is deliberately filled by a large shape.
- Margins: keep text at least 7% of the artboard width from every edge. Align to a few shared left edges or to the center.
- One clear focal point: a large headline. Then a clear hierarchy: headline, a supporting line, small details, one call to action when the brief is promotional or an event.
- Shapes support the text: blocks behind text, bands, circles cropped by the edge for movement, thin rules to separate details. Shapes may run off the artboard edge; text may not. Every shape needs a reason; no stray decoration.

Copy and color:
- Write the copy yourself unless the brief gives it, short and specific, in the language the user wrote in. Never use lorem ipsum or "Your text here". Use text given in the brief exactly as written.
- A palette of 2-4 colors with strong contrast between text and what sits behind it.
- At most two font families: one for headings, one for body. Script fonts only for a word or two.

Geometry (the editor's coordinate system):
- Pixels, origin at the top-left, x to the right, y down. x/y is an element's top-left corner.
- A circle's box starts at x/y; its center is (x + r, y + r).
- Text wraps inside its box width w. A line holds about w / (size x c) characters, where c is 0.55 for most fonts, 0.44 for condensed fonts (Bebas Neue, Anton, Oswald, Staatliches, Barlow) and 0.64 for wide or heavy ones (Archivo Black, Alfa Slab One, Bungee, mono fonts); bold adds about 0.03.
- A text block's height is lines x size x lineHeight x 1.13. The next element below it must start at least 0.4 x size lower than that bottom.
- To color one word of a heading differently, make it its own text element and place it exactly one line below the previous block's bottom, using the height rule above.
- Elements are drawn in order; backgrounds and shapes first, text last.
- Use opacity below 1 sparingly. Leave angle at 0 unless a tilt is part of the idea.

Pick the format that fits the request when the brief doesn't fix it (a poster or flyer is A4 Portrait; a post is Instagram Post; a story is Story / Reels; a slide is Presentation).`;

// ---------------------------------------------------------- the safety net

export const HEX = /^#[0-9a-f]{6}$/i;
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
// fonts reach the editor. A format fixed in the brief always wins.
// deno-lint-ignore no-explicit-any
export function clean(raw: any, fixedFormat?: string) {
  const format = FORMATS.find((f) => f.label === fixedFormat) ?? FORMATS.find((f) => f.label === raw?.format) ?? FORMATS[0];
  const { w: W, h: H } = format;
  const big = Math.max(W, H);
  const elements = [];
  for (const el of Array.isArray(raw?.elements) ? raw.elements.slice(0, 40) : []) {
    const common = { x: n(el.x, -W, W * 2), y: n(el.y, -H, H * 2), opacity: n(el.opacity, 0, 1, 1) };
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
  return { title, format: format.label, scene: { w: W, h: H, bg: hex(raw?.bg, "#ffffff"), elements } };
}

// ---------------------------------------------------------- the layout check

// deno-lint-ignore no-explicit-any
function textBox(el: any) {
  const per = el.size * charWidth(el.font, el.weight) + (el.letterSpacing || 0);
  const perLine = Math.max(1, Math.floor(el.w / per));
  let lines = 0;
  for (const para of el.text.split("\n")) {
    // words wrap whole, so a line holds a little less than its width
    lines += Math.max(1, Math.ceil(para.length / (perLine * 0.92)));
  }
  const h = lines * el.size * el.lineHeight * 1.13;
  return { x: el.x, y: el.y, w: el.w, h, bottom: el.y + h, label: el.text.split("\n")[0].slice(0, 30) };
}

// Plain-words problems a second pass can fix; an empty list means it looks right.
// deno-lint-ignore no-explicit-any
export function inspect(scene: any) {
  const { w: W, h: H } = scene;
  const issues: string[] = [];
  // deno-lint-ignore no-explicit-any
  const texts = scene.elements.filter((e: any) => e.type === "text" && !e.angle).map(textBox);

  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      const xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
      if (xOverlap > 10 && yOverlap > 4) {
        issues.push(`Text "${a.label}" (y ${Math.round(a.y)} to about ${Math.round(a.bottom)}) overlaps text "${b.label}" (starts at y ${Math.round(b.y)}).`);
      }
    }
  }

  const margin = W * 0.04;
  for (const t of texts) {
    if (t.x < margin || t.x + t.w > W - margin || t.y < margin || t.bottom > H - margin) {
      issues.push(`Text "${t.label}" runs into the edge or off the artboard (box ${Math.round(t.x)},${Math.round(t.y)} to ${Math.round(t.x + t.w)},${Math.round(t.bottom)} on a ${W}x${H} artboard).`);
    }
  }

  // the tallest stretch of the page with no text and no shape inside the artboard
  const spans = texts.map((t: { y: number; bottom: number }) => [t.y, t.bottom]);
  // deno-lint-ignore no-explicit-any
  for (const e of scene.elements as any[]) {
    if (e.type === "text" || (e.opacity ?? 1) < 0.5) continue;
    const top = e.y, bottom = e.type === "circle" ? e.y + e.r * 2 : e.y + e.h;
    const width = e.type === "circle" ? e.r * 2 : e.w;
    // a shape covering most of the page is a background, not content
    if (width >= W * 0.95 && bottom - top >= H * 0.95) continue;
    spans.push([Math.max(0, top), Math.min(H, bottom)]);
  }
  spans.sort((a: number[], b: number[]) => a[0] - b[0]);
  let reach = 0, gap = 0, gapAt = 0;
  for (const [top, bottom] of spans) {
    if (top - reach > gap) { gap = top - reach; gapAt = reach; }
    reach = Math.max(reach, bottom);
  }
  if (H - reach > gap) { gap = H - reach; gapAt = reach; }
  if (gap > H * 0.2) {
    issues.push(`About ${Math.round((gap / H) * 100)}% of the page height (y ${Math.round(gapAt)} to ${Math.round(gapAt + gap)}) is empty. Spread the content over the whole page.`);
  }
  const lowest = texts.reduce((m: number, t: { bottom: number }) => Math.max(m, t.bottom), 0);
  // tall pages (posters, stories) read top to bottom, so they need content low down
  if (texts.length && H >= W * 1.2 && lowest < H * 0.8) {
    issues.push(`The lowest text ends at y ${Math.round(lowest)}, but should end near the bottom (after y ${Math.round(H * 0.85)}).`);
  }
  return [...new Set(issues)].slice(0, 12);
}
