// Simple icon edits (color, rotate, flip, background, size) done on the SVG
// itself, so the preview and every downloaded file match exactly.

const CANVAS = 512;

// 16–48 for UI work in Figma, 128–512 for slides, social and print
export const iconSizes = [16, 24, 32, 48, 64, 128, 256, 512];
export const iconColors = ["#000000", "#6b7280", "#f0202d", "#2563eb", "#16a34a", "#f59e0b"];

// glyph and outline icons are one color, so the color can be changed safely
export const canRecolor = (style) => style === "glyph" || style === "outline";

export const fileSlug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const defaultEdits = {
  color: "#000000",
  rotate: 0,
  flipX: false,
  flipY: false,
  shape: "none",
  bgColor: "#e4e4e7",
  scale: 100,
  // flat icons: original color -> replacement
  palette: {},
};

// "#ABC" and "#aabbcc" become "#aabbcc", so one color has one key
function normalizeHex(hex) {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

const paintAttr = /\b(fill|stroke)="(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)"/g;
const paintStyle = /\b(fill|stroke):\s*(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)/g;

// The distinct solid colors of a flat icon, in drawing order.
function readColors(markup) {
  const found = [...markup.matchAll(paintAttr), ...markup.matchAll(paintStyle)];
  return [...new Set(found.map((m) => normalizeHex(m[2])))];
}

function swapColors(markup, palette) {
  const swap = (hex) => palette[normalizeHex(hex)] ?? hex;
  return markup
    .replace(paintAttr, (_, prop, hex) => `${prop}="${swap(hex)}"`)
    .replace(paintStyle, (_, prop, hex) => `${prop}:${swap(hex)}`);
}

// Reads an icon file and keeps only what the editor needs.
export async function loadIconSvg(src) {
  const text = await (await fetch(src)).text();
  const svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  if (svg.nodeName !== "svg") throw new Error("Not an SVG file");

  svg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());

  const width = parseFloat(svg.getAttribute("width")) || CANVAS;
  const height = parseFloat(svg.getAttribute("height")) || CANVAS;

  return {
    viewBox: svg.getAttribute("viewBox") || `0 0 ${width} ${height}`,
    inner: svg.innerHTML,
    colors: readColors(svg.innerHTML),
  };
}

// Single-color icons (glyph, outline): every painted fill and stroke takes the new color.
function recolor(markup, color) {
  return markup
    .replace(/\b(fill|stroke)="(?!none)[^"]*"/g, `$1="${color}"`)
    .replace(/\b(fill|stroke):\s*(?!none)[^;"]+/g, `$1:${color}`);
}

const backgrounds = {
  circle: (c) => `<circle cx="256" cy="256" r="256" fill="${c}"/>`,
  square: (c) => `<rect width="512" height="512" fill="${c}"/>`,
  rounded: (c) => `<rect width="512" height="512" rx="104" fill="${c}"/>`,
};

// color recolors the whole icon (glyph, outline); with color null the palette
// swaps single colors (flat), and an empty palette keeps the original.
export function buildIconSvg(source, edits, px = CANVAS) {
  const { color, rotate, flipX, flipY, shape, bgColor, scale, palette = {} } = edits;
  const s = scale / 100;
  const transform =
    `translate(256 256) rotate(${rotate}) ` +
    `scale(${flipX ? -s : s} ${flipY ? -s : s}) translate(-256 -256)`;

  const bg = backgrounds[shape]?.(bgColor) ?? "";
  const paint = color ? ` fill="${color}"` : "";
  const inner = color ? recolor(source.inner, color) : swapColors(source.inner, palette);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${px}" height="${px}" viewBox="0 0 ${CANVAS} ${CANVAS}">` +
    bg +
    `<g transform="${transform}">` +
    `<svg width="${CANVAS}" height="${CANVAS}" viewBox="${source.viewBox}" overflow="visible"${paint}>` +
    inner +
    `</svg></g></svg>`
  );
}

export const svgDataUrl = (svg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export async function svgToPng(svg, px) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    canvas.getContext("2d").drawImage(img, 0, 0, px, px);

    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
