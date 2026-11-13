// Logos on /admin. Files with the same name make one logo: a JPG preview
// (its IPTC/XMP metadata gives title, description and keywords, as for
// vectors) plus the source files buyers get: AI, EPS, SVG, PDF or PNG.
// A logo at 600 px is already usable, so Premium and Exclusive logos get
// the watermark in the pixels of both the thumbnail and the preview.
// Exclusive logos carry a USD price and are sold once.
import { supabase } from "../../lib/supabaseClient";
import { uploadToR2 } from "../../lib/r2";
import { drawWatermark, readMetadata, shortTitle } from "./vectorUpload";

const SOURCE_TYPES = {
  ai: ["AI", "application/postscript", "Adobe Illustrator"],
  eps: ["EPS", "application/postscript", "Editable vector"],
  svg: ["SVG", "image/svg+xml", "For web and Figma"],
  pdf: ["PDF", "application/pdf", "Print ready"],
  png: ["PNG", "image/png", "Transparent background"],
};

const baseName = (name) => name.replace(/\.[^.]+$/, "");
const extOf = (name) => name.split(".").pop().toLowerCase();
const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "logo";

export function pairLogos(fileList) {
  const groups = new Map();
  for (const file of fileList) {
    const ext = extOf(file.name);
    const isPreview = ext === "jpg" || ext === "jpeg";
    if (!isPreview && !SOURCE_TYPES[ext]) continue;
    const base = baseName(file.name);
    const group = groups.get(base) ?? { base, sources: [] };
    if (isPreview) group.jpg = file;
    else group.sources.push(file);
    groups.set(base, group);
  }
  return [...groups.values()].sort((a, b) => a.base.localeCompare(b.base, undefined, { numeric: true }));
}

export const sourceLabel = (file) => SOURCE_TYPES[extOf(file.name)]?.[0] ?? extOf(file.name).toUpperCase();

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
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
  if (!blob) throw new Error("This browser couldn't make the preview");
  return blob;
}

export async function readLogo(jpg) {
  const meta = await readMetadata(jpg).catch(() => ({ longTitle: "", description: "", keywords: [] }));
  return { ...meta, title: shortTitle(meta.longTitle) || shortTitle(baseName(jpg.name)) };
}

const newCode = () => `KD-LG-${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;

export async function publishLogo(item, onStep) {
  if (item.license === "exclusive" && !(item.price > 0)) throw new Error("Exclusive logos need a price");
  const bitmap = await createImageBitmap(item.jpg);
  const watermark = item.license !== "free";
  let images;
  try {
    images = {
      width: bitmap.width,
      height: bitmap.height,
      thumb: await renderJpeg(bitmap, 600, watermark),
      preview: await renderJpeg(bitmap, 1500, watermark),
    };
  } finally {
    bitmap.close();
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    const folder = `logos/${code}`;
    const name = slug(item.title);
    const sources = item.sources.map((file) => {
      const [format, contentType, label] = SOURCE_TYPES[extOf(file.name)];
      return { bucket: "private", key: `${folder}/${name}.${extOf(file.name)}`, file, contentType, format, label };
    });
    const steps = [
      { bucket: "public", key: `${folder}/thumb.jpg`, file: images.thumb, contentType: "image/jpeg" },
      { bucket: "public", key: `${folder}/preview.jpg`, file: images.preview, contentType: "image/jpeg" },
      // the full-size JPG is a source too, kept private
      { bucket: "private", key: `${folder}/${name}.jpg`, file: item.jpg, contentType: "image/jpeg", format: "JPG", label: "High-resolution JPG" },
      ...sources,
    ];
    const total = steps.reduce((sum, s) => sum + s.file.size, 0);
    let done = 0;
    for (const step of steps) {
      await uploadToR2({ ...step, onProgress: (p) => onStep("Uploading", (done + p * step.file.size) / total) });
      done += step.file.size;
    }

    onStep("Saving", 1);
    const { error } = await supabase.from("assets").insert({
      code,
      batch_id: item.batchId ?? null,
      source_name: item.base,
      type: "logo",
      status: "published",
      title: item.title.trim(),
      long_title: item.longTitle || null,
      description: item.description || null,
      keywords: item.keywords,
      industry: item.industry,
      style: item.style,
      license: item.license,
      price_cents: item.license === "exclusive" ? Math.round(item.price * 100) : null,
      thumb_key: steps[0].key,
      preview_key: steps[1].key,
      files: steps.slice(2).map((s) => ({ format: s.format, key: s.key, bytes: s.file.size, label: s.label })),
      width: images.width,
      height: images.height,
      orientation: "square",
    });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't find a free logo code, try again");
}
