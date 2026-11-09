// Turns files into parts for the Create editor, the way Canva and VistaCreate
// sort them: elements (SVG stays recolorable, PNG keeps its transparency) and
// backgrounds (usually JPG). The editor needs the file itself, so it lives in
// the public bucket, at most 3000 px on its long side.
import { supabase } from "../../lib/supabaseClient";
import { uploadToR2 } from "../../lib/r2";
import { readMetadata, shortTitle } from "./vectorUpload";

export const ELEMENT_CATEGORIES = ["stickers", "illustrations", "shapes", "frames", "lines", "badges", "other"];
export const BACKGROUND_CATEGORIES = ["abstract", "gradient", "nature", "pattern", "texture", "holiday", "business", "other"];
export const categoriesOf = (kind) => (kind === "background" ? BACKGROUND_CATEGORIES : ELEMENT_CATEGORIES);

const MAX_PX = 3000;
const THUMB_PX = 480;

const baseName = (name) => name.replace(/\.[^.]+$/, "");
const extOf = (name) => name.split(".").pop().toLowerCase();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "element";
const newCode = () => `KD-EL-${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;
const orientationOf = (w, h) => (w === h ? "square" : w > h ? "landscape" : "portrait");

export const isElementFile = (file) => ["svg", "png", "jpg", "jpeg"].includes(extOf(file.name));

async function svgSize(file) {
  const doc = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName !== "svg" || doc.querySelector("parsererror")) throw new Error("This SVG file can't be read");
  const box = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  const width = box[2] || parseFloat(svg.getAttribute("width")) || 512;
  const height = box[3] || parseFloat(svg.getAttribute("height")) || 512;
  return { width: Math.round(width), height: Math.round(height) };
}

// what a dropped file is, read before anyone publishes it
export async function readElement(file) {
  const format = extOf(file.name) === "svg" ? "SVG" : extOf(file.name) === "png" ? "PNG" : "JPG";
  const kind = format === "JPG" ? "background" : "element";
  let size;
  if (format === "SVG") {
    size = await svgSize(file);
  } else {
    const bitmap = await createImageBitmap(file);
    size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
  }
  const meta = format === "SVG"
    ? { longTitle: "", description: "", keywords: [] }
    : await readMetadata(file).catch(() => ({ longTitle: "", description: "", keywords: [] }));
  const fromName = baseName(file.name).replace(/[-_]+/g, " ");
  return {
    ...meta,
    ...size,
    format,
    kind,
    category: categoriesOf(kind)[0],
    title: shortTitle(meta.longTitle) || shortTitle(fromName) || fromName,
  };
}

async function shrunk(file, max, type, quality) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob) throw new Error("This browser couldn't prepare the file");
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
  }
}

export async function publishElement(item, onStep) {
  const isSvg = item.format === "SVG";
  const ext = isSvg ? "svg" : item.format === "PNG" ? "png" : "jpg";
  const type = isSvg ? "image/svg+xml" : item.format === "PNG" ? "image/png" : "image/jpeg";

  onStep("Preparing", 0);
  let main = { blob: item.file, width: item.width, height: item.height };
  if (!isSvg && Math.max(item.width, item.height) > MAX_PX) main = await shrunk(item.file, MAX_PX, type, 0.92);
  // an SVG is its own thumbnail; it's small and sharp at any size
  const thumb = isSvg ? null : await shrunk(item.file, THUMB_PX, type, 0.8);

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    const folder = `elements/${code}`;
    const mainKey = `${folder}/${slug(item.title)}.${ext}`;
    const thumbKey = thumb ? `${folder}/thumb.${ext}` : mainKey;

    const steps = [{ key: mainKey, file: main.blob }];
    if (thumb) steps.push({ key: thumbKey, file: thumb.blob });
    const total = steps.reduce((sum, s) => sum + s.file.size, 0);
    let done = 0;
    for (const step of steps) {
      await uploadToR2({
        bucket: "public",
        key: step.key,
        file: step.file,
        contentType: type,
        onProgress: (p) => onStep("Uploading", (done + p * step.file.size) / total),
      });
      done += step.file.size;
    }

    onStep("Saving", 1);
    const { error } = await supabase.from("assets").insert({
      code,
      type: "element",
      status: "published",
      title: item.title.trim(),
      long_title: item.longTitle || null,
      description: item.description || null,
      keywords: item.keywords,
      category: item.category,
      // element or background
      style: item.kind,
      license: item.license,
      thumb_key: thumbKey,
      preview_key: thumbKey,
      files: [{ format: item.format, key: mainKey, bytes: main.blob.size, label: "For Create", bucket: "public" }],
      width: main.width,
      height: main.height,
      orientation: orientationOf(main.width, main.height),
    });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't find a free element code, try again");
}
