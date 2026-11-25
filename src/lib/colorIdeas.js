// Color ideas, worked out in the browser (no AI service, free for everyone):
// palettes built from the main color already in the design, by color theory.
const hexOf = (c) => {
  if (typeof c !== "string") return null;
  const s = c.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return `#${m[1].split("").map((x) => x + x).join("")}`;
  m = s.match(/^#([0-9a-f]{6})/);
  if (m) return `#${m[1]}`;
  m = s.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  return null;
};

function toHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function toHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.min(1, Math.max(0, s));
  l = Math.min(1, Math.max(0, l));
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[0, 8, 4].map((n) => Math.round(f(n) * 255).toString(16).padStart(2, "0")).join("")}`;
}

// the colors used in the design, most used first (whites, blacks and greys last)
export function designColors(objects) {
  const counts = new Map();
  const walk = (o) => {
    for (const c of [o.fill, o.stroke]) {
      const hex = hexOf(c);
      if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    o.getObjects?.().forEach(walk);
  };
  objects.forEach(walk);
  return [...counts.entries()]
    .sort((a, b) => (toHsl(b[0])[1] > 0.12) - (toHsl(a[0])[1] > 0.12) || b[1] - a[1])
    .map(([hex]) => hex);
}

// four palettes of five colors around the main color
export function colorIdeas(colors) {
  const base = colors.find((c) => toHsl(c)[1] > 0.12) ?? "#e5252a";
  const [h, s, l] = toHsl(base);
  const ss = Math.max(s, 0.45);
  return [
    ["Matching shades", [toHex(h, ss, 0.2), toHex(h, ss, 0.35), base, toHex(h, ss * 0.8, 0.72), toHex(h, ss * 0.5, 0.93)]],
    ["Neighbours", [toHex(h - 30, ss, l), toHex(h - 15, ss, l), base, toHex(h + 15, ss, l), toHex(h + 30, ss, 0.92)]],
    ["Contrast", [toHex(h, ss, 0.15), base, toHex(h + 180, ss, l), toHex(h + 180, ss * 0.6, 0.85), "#f7f5f0"]],
    ["Three-way", [base, toHex(h + 120, ss, l), toHex(h + 240, ss, l), toHex(h, 0.1, 0.15), toHex(h, 0.15, 0.95)]],
  ];
}
