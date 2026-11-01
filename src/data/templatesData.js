// Templates are stored as editable scenes (not flat images) so they can be
// opened in Create and have their text, colors and elements changed.
// Element coordinates are in artboard pixels; x/y is the top-left corner.

const palettes = [
  { name: "Noir", bg: "#0d0e10", accent: "#e7212e", text: "#ffffff", soft: "#1c1e22" },
  { name: "Sage", bg: "#f5efe6", accent: "#1f6f5c", text: "#1d1d1d", soft: "#e4dccd" },
  { name: "Navy", bg: "#1b2a4a", accent: "#f5b700", text: "#ffffff", soft: "#24375f" },
  { name: "Blush", bg: "#ffe4ec", accent: "#d6336c", text: "#2b2b2b", soft: "#ffc9d9" },
];

const font = "Space Grotesk";

const designs = [
  {
    title: "big sale social post",
    category: "social media",
    tags: ["sale", "promo", "instagram", "discount"],
    w: 1080, h: 1080,
    build: (p) => [
      { type: "circle", x: 620, y: -160, r: 360, fill: p.accent },
      { type: "text", x: 90, y: 110, w: 600, text: "KHULQIDESIGN", size: 34, weight: 700, fill: p.text },
      { type: "text", x: 90, y: 380, w: 900, text: "BIG SALE", size: 190, weight: 700, fill: p.text },
      { type: "text", x: 90, y: 600, w: 800, text: "Up to 50% off for all products this week", size: 48, fill: p.text },
      { type: "rect", x: 90, y: 820, w: 340, h: 100, r: 50, fill: p.accent },
      { type: "text", x: 90, y: 850, w: 340, text: "Shop Now", size: 36, weight: 700, fill: "#ffffff", align: "center" },
    ],
  },
  {
    title: "travel story",
    category: "story",
    tags: ["travel", "story", "reels", "vacation"],
    w: 1080, h: 1920,
    build: (p) => [
      { type: "image", x: 0, y: 0, w: 1080, h: 1150, src: "/preview4.jpg" },
      { type: "rect", x: 80, y: 1060, w: 920, h: 640, r: 40, fill: p.soft },
      { type: "text", x: 140, y: 1130, w: 800, text: "EXPLORE", size: 40, weight: 700, fill: p.accent },
      { type: "text", x: 140, y: 1200, w: 800, text: "Your Next Adventure", size: 110, weight: 700, fill: p.text },
      { type: "text", x: 140, y: 1500, w: 800, text: "Swipe up to see the full guide", size: 42, fill: p.text },
    ],
  },
  {
    title: "youtube thumbnail",
    category: "thumbnail",
    tags: ["youtube", "thumbnail", "video", "tutorial"],
    w: 1280, h: 720,
    build: (p) => [
      { type: "image", x: 640, y: 0, w: 640, h: 720, src: "/preview2.jpg" },
      { type: "rect", x: 60, y: 90, w: 220, h: 64, r: 12, fill: p.accent },
      { type: "text", x: 60, y: 104, w: 220, text: "NEW VIDEO", size: 30, weight: 700, fill: "#ffffff", align: "center" },
      { type: "text", x: 60, y: 200, w: 560, text: "10 Design Tips You Need", size: 92, weight: 700, fill: p.text },
    ],
  },
  {
    title: "presentation title slide",
    category: "presentation",
    tags: ["presentation", "slide", "pitch deck", "business"],
    w: 1920, h: 1080,
    build: (p) => [
      { type: "rect", x: 0, y: 0, w: 24, h: 1080, fill: p.accent },
      { type: "text", x: 160, y: 320, w: 1400, text: "Annual Report 2026", size: 140, weight: 700, fill: p.text },
      { type: "text", x: 160, y: 520, w: 1200, text: "Growth, highlights and the road ahead", size: 56, fill: p.text },
      { type: "rect", x: 160, y: 760, w: 120, h: 8, fill: p.accent },
      { type: "text", x: 160, y: 800, w: 900, text: "Presented by Khulqidesign", size: 40, fill: p.text },
    ],
  },
  {
    title: "event poster",
    category: "poster",
    tags: ["poster", "event", "concert", "a4"],
    w: 1240, h: 1754,
    build: (p) => [
      { type: "circle", x: 270, y: 260, r: 350, fill: p.accent },
      { type: "image", x: 370, y: 360, w: 500, h: 500, src: "/preview3.jpg" },
      { type: "text", x: 100, y: 1080, w: 1040, text: "DESIGN FEST", size: 150, weight: 700, fill: p.text, align: "center" },
      { type: "text", x: 100, y: 1290, w: 1040, text: "24 — 26 November · Jakarta", size: 54, fill: p.text, align: "center" },
      { type: "rect", x: 420, y: 1460, w: 400, h: 110, r: 55, fill: p.accent },
      { type: "text", x: 420, y: 1492, w: 400, text: "Get Tickets", size: 42, weight: 700, fill: "#ffffff", align: "center" },
    ],
  },
  {
    title: "product flyer",
    category: "flyer",
    tags: ["flyer", "product", "launch", "marketing"],
    w: 1080, h: 1350,
    build: (p) => [
      { type: "rect", x: 60, y: 60, w: 960, h: 760, r: 32, fill: p.soft },
      { type: "image", x: 140, y: 140, w: 800, h: 600, src: "/preview1.jpg" },
      { type: "text", x: 80, y: 880, w: 920, text: "New Collection", size: 96, weight: 700, fill: p.text },
      { type: "text", x: 80, y: 1010, w: 920, text: "Minimal, modern and made to last.", size: 44, fill: p.text },
      { type: "text", x: 80, y: 1180, w: 920, text: "khulqidesign.com", size: 38, weight: 700, fill: p.accent },
    ],
  },
  {
    title: "business card",
    category: "business card",
    tags: ["business card", "branding", "contact", "print"],
    w: 1050, h: 600,
    build: (p) => [
      { type: "rect", x: 0, y: 0, w: 320, h: 600, fill: p.accent },
      { type: "text", x: 40, y: 260, w: 240, text: "KD", size: 96, weight: 700, fill: "#ffffff", align: "center" },
      { type: "text", x: 390, y: 150, w: 600, text: "Khulqi Rosyid", size: 64, weight: 700, fill: p.text },
      { type: "text", x: 390, y: 240, w: 600, text: "Creative Director", size: 34, fill: p.text },
      { type: "text", x: 390, y: 380, w: 600, text: "hello@khulqidesign.com\n+62 852 0000 0000", size: 30, fill: p.text },
    ],
  },
  {
    title: "quote post",
    category: "social media",
    tags: ["quote", "motivation", "instagram", "typography"],
    w: 1080, h: 1080,
    build: (p) => [
      { type: "text", x: 90, y: 120, w: 300, text: "“", size: 260, weight: 700, fill: p.accent, font: "Georgia" },
      { type: "text", x: 90, y: 360, w: 900, text: "Design is not just what it looks like. Design is how it works.", size: 68, fill: p.text, font: "Georgia" },
      { type: "rect", x: 90, y: 800, w: 80, h: 6, fill: p.accent },
      { type: "text", x: 90, y: 840, w: 900, text: "Steve Jobs", size: 40, weight: 700, fill: p.text },
    ],
  },
];

const orientationOf = (w, h) => (w === h ? "square" : w > h ? "landscape" : "portrait");

export const templateCategories = [...new Set(designs.map((d) => d.category))];

export const allTemplates = palettes.flatMap((palette, pi) =>
  designs.map((d, di) => {
    const i = pi * designs.length + di;
    return {
      id: i + 1,
      code: `KD-TP-${String(400000 + i * 13).padStart(6, "0")}`,
      title: `${d.title} — ${palette.name.toLowerCase()}`,
      category: d.category,
      w: d.w,
      h: d.h,
      orientation: orientationOf(d.w, d.h),
      license: i % 3 === 0 ? "premium" : "free",
      downloads: (i * 41) % 700,
      keywords: [...d.tags, d.category, palette.name.toLowerCase(), "template", "editable"],
      scene: { w: d.w, h: d.h, bg: palette.bg, elements: d.build(palette).map((el) => ({ font, ...el })) },
    };
  })
);
