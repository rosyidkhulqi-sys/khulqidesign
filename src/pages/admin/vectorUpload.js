// Everything the admin page does to turn an EPS + JPG pair into a published
// vector: pair files by name, read the JPG's IPTC/XMP metadata (the same the
// owner writes for Adobe Stock and Shutterstock), read the EPS artboard, make
// a 600 px thumbnail and a 1500 px watermarked preview in the browser, upload
// all four files to R2 and write the catalogue row.
import exifr from "exifr";
import { supabase } from "../../lib/supabaseClient";
import { uploadToR2 } from "../../lib/r2";

export const VECTOR_CATEGORIES = [
  "abstract", "background", "business", "education", "food", "holiday",
  "nature", "people", "technology", "texture", "other",
];

const baseName = (name) => name.replace(/\.[^.]+$/, "");
const extOf = (name) => name.split(".").pop().toLowerCase();

// EPS + JPG with the same name make one vector; anything else is reported
export function pairFiles(fileList) {
  const groups = new Map();
  for (const file of fileList) {
    const ext = extOf(file.name);
    if (!["eps", "jpg", "jpeg"].includes(ext)) continue;
    const base = baseName(file.name);
    const group = groups.get(base) ?? { base };
    if (ext === "eps") group.eps = file;
    else group.jpg = file;
    groups.set(base, group);
  }
  return [...groups.values()].sort((a, b) => a.base.localeCompare(b.base, undefined, { numeric: true }));
}

// exifr returns XMP text as a string, a { lang, value } object or an array
function text(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  if (typeof value === "object") return text(value.value ?? Object.values(value)[0]);
  return String(value);
}

function list(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(/[,;]/);
  return [...new Set(items.map((k) => text(k).toLowerCase()).filter(Boolean))];
}

// "Rooster Mascot Restaurant Logo Modern Food Branding. Vector Illustration"
// -> "Rooster mascot restaurant logo": short enough for a card
// words a short title shouldn't end on
const TRAILING = new Set(["with", "and", "for", "of", "the", "a", "an", "in", "on", "to", "or", "at", "by"]);

export function shortTitle(long) {
  const clean = long
    .replace(/\.?\s*vector illustration\.?\s*$/i, "")
    .split(/[,.;:]/)[0]
    .replace(/\s+/g, " ")
    .trim();
  const words = clean.split(" ").slice(0, 6);
  while (words.length > 1 && TRAILING.has(words[words.length - 1].toLowerCase())) words.pop();
  const short = words.join(" ").slice(0, 60).trim();
  return short ? short.charAt(0).toUpperCase() + short.slice(1).toLowerCase() : "";
}

export async function readMetadata(jpg) {
  const meta = (await exifr.parse(jpg, { iptc: true, xmp: true, tiff: false, exif: false })) ?? {};
  const longTitle = text(meta.title) || text(meta.ObjectName) || text(meta.Headline);
  const description = text(meta.description) || text(meta.Caption) || text(meta["Caption-Abstract"]);
  const keywords = list(meta.subject).length ? list(meta.subject) : list(meta.Keywords);
  return { longTitle, description, keywords };
}

// "%%BoundingBox: 0 0 3000 3000" in the EPS header gives the artboard in pt
export async function readArtboard(eps) {
  const head = await eps.slice(0, 16_384).text();
  const match = head.match(/%%(?:HiRes)?BoundingBox:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/);
  if (!match) return null;
  const [x1, y1, x2, y2] = match.slice(1).map(Number);
  return [Math.round(x2 - x1), Math.round(y2 - y1)];
}

// Tiled, as stock previews are, so no corner can be cropped out clean, but
// spaced out so the work can still be judged. Sized from the picture, so every
// asset looks alike. The trial previews draw the same mark with CSS
// (.asset-watermark).
export function drawWatermark(ctx, w, h) {
  const longSide = Math.max(w, h);
  const size = Math.max(11, Math.round(longSide / 27));
  const stepX = longSide * 0.467;
  const stepY = longSide * 0.35;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((-25 * Math.PI) / 180);
  ctx.font = `700 ${size}px "DM Sans", system-ui, sans-serif`;
  // not in every browser; the mark just sits a little tighter without it
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(size / 6).toFixed(1)}px`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  // the soft dark edge is what keeps white letters visible on a white picture
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = Math.max(1, size / 11);
  const columns = Math.ceil(Math.hypot(w, h) / stepX);
  const rows = Math.ceil(Math.hypot(w, h) / stepY);
  for (let row = -rows; row <= rows; row++) {
    for (let col = -columns; col <= columns; col++) {
      ctx.fillText("KHULQIDESIGN", col * stepX, row * stepY);
    }
  }
  ctx.restore();
}

// a JPEG no longer than `max` px, optionally watermarked
async function renderJpeg(bitmap, max, watermark) {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (watermark) drawWatermark(ctx, w, h);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("This browser couldn't make the preview");
  return blob;
}

// Premium previews carry the watermark in their pixels; free ones don't
export async function makeImages(jpg, watermark) {
  const bitmap = await createImageBitmap(jpg);
  try {
    return {
      width: bitmap.width,
      height: bitmap.height,
      thumb: await renderJpeg(bitmap, 600, false),
      preview: await renderJpeg(bitmap, 1500, watermark),
    };
  } finally {
    bitmap.close();
  }
}

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "vector";

const newCode = () => `KD-VC-${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;

// Upload one pair and publish it. onStep(label, progress 0..1) drives the UI.
export async function publishVector(item, onStep) {
  const images = await makeImages(item.jpg, item.license === "premium");
  const artboard = (await readArtboard(item.eps)) ?? [images.width, images.height];
  const [w, h] = artboard;

  // a fresh public code; the unique index catches the rare clash
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    const name = slug(item.title);
    const folder = `vectors/${code}`;
    const steps = [
      { bucket: "private", key: `${folder}/${name}.eps`, file: item.eps, contentType: "application/postscript", label: "EPS" },
      { bucket: "private", key: `${folder}/${name}.jpg`, file: item.jpg, contentType: "image/jpeg", label: "JPG" },
      { bucket: "public", key: `${folder}/thumb.jpg`, file: images.thumb, contentType: "image/jpeg", label: "Thumbnail" },
      { bucket: "public", key: `${folder}/preview.jpg`, file: images.preview, contentType: "image/jpeg", label: "Preview" },
    ];
    const total = steps.reduce((sum, s) => sum + s.file.size, 0);
    let done = 0;
    for (const step of steps) {
      await uploadToR2({
        ...step,
        onProgress: (p) => onStep(`Uploading ${step.label}`, (done + p * step.file.size) / total),
      });
      done += step.file.size;
    }

    onStep("Saving", 1);
    const { error } = await supabase.from("assets").insert({
      code,
      type: "vector",
      status: "published",
      title: item.title,
      long_title: item.longTitle || null,
      description: item.description || null,
      keywords: item.keywords,
      category: item.category,
      license: item.license,
      thumb_key: steps[2].key,
      preview_key: steps[3].key,
      files: [
        { format: "EPS", key: steps[0].key, bytes: item.eps.size, label: "Editable vector", width: w, height: h },
        { format: "JPG", key: steps[1].key, bytes: item.jpg.size, label: "High-resolution JPG", width: images.width, height: images.height },
      ],
      width: w,
      height: h,
      orientation: w === h ? "square" : w > h ? "landscape" : "portrait",
    });
    if (!error) return code;
    // 23505: unique violation on code; try another code
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't find a free asset code, try again");
}
