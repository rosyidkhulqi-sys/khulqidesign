// Turns files into parts for the Create editor, the way Canva and VistaCreate
// sort them: elements (SVG stays recolorable, PNG keeps its transparency) and
// backgrounds (usually JPG). The editor needs the file itself, so it lives in
// the public bucket, at most 3000 px on its long side.
import { supabase } from "../../lib/supabaseClient";
import { uploadToR2 } from "../../lib/r2";
import { parseKeywords, readMetadata, shortTitle } from "./vectorUpload";
import {
  BACKGROUND_CATEGORIES,
  ELEMENT_CATEGORIES,
  backgroundCategoryLabel,
  elementCategoryLabel,
  elementCategoryStorageValues,
  normalizeElementCategory,
} from "../../data/elementCategories";

export {
  BACKGROUND_CATEGORIES,
  ELEMENT_CATEGORIES,
  backgroundCategoryLabel,
  elementCategoryLabel,
  elementCategoryStorageValues,
  normalizeElementCategory,
};
export const categoriesOf = (kind) => (kind === "background" ? BACKGROUND_CATEGORIES : ELEMENT_CATEGORIES);

// as on MiriCanvas: a short name and a few keywords that really fit
export const MAX_KEYWORDS = 25;

const MAX_PX = 3000;
const THUMB_PX = 480;

const baseName = (name) => name.replace(/\.[^.]+$/, "");
const extOf = (name) => name.split(".").pop().toLowerCase();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "element";
const newCode = () => `KD-EL-${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;
const orientationOf = (w, h) => (w === h ? "square" : w > h ? "landscape" : "portrait");

export const isElementFile = (file) => ["svg", "png", "jpg", "jpeg"].includes(extOf(file.name));

const clean = (node) => node?.textContent.replace(/\s+/g, " ").trim() ?? "";

// SVG metadata lives in the file itself: <title> and <desc>, and Dublin Core
// (title, description, subject) when Illustrator or Inkscape wrote it
function svgMetadata(svg) {
  const own = (name) => [...svg.children].find((n) => n.localName === name);
  const dublin = (name) => svg.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", name)[0];
  const subject = dublin("subject");
  return {
    longTitle: clean(dublin("title")) || clean(own("title")),
    description: clean(dublin("description")) || clean(own("desc")),
    keywords: subject ? [...subject.getElementsByTagNameNS("*", "li")].map(clean).filter(Boolean) : [],
  };
}

async function readSvg(file) {
  const doc = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName !== "svg" || doc.querySelector("parsererror")) throw new Error("This SVG file can't be read");
  const box = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  const width = box[2] || parseFloat(svg.getAttribute("width")) || 512;
  const height = box[3] || parseFloat(svg.getAttribute("height")) || 512;
  return { width: Math.round(width), height: Math.round(height), meta: svgMetadata(svg) };
}

// what still has to be filled in; search and SEO depend on these
export function missingField(item) {
  if (!item.title.trim()) return "title";
  if (!item.category) return "category";
  if (!item.keywords.length) return "keywords";
  return null;
}

// what a dropped file is, read before anyone publishes it
export async function readElement(file) {
  const format = extOf(file.name) === "svg" ? "SVG" : extOf(file.name) === "png" ? "PNG" : "JPG";
  const kind = format === "JPG" ? "background" : "element";
  const blank = { longTitle: "", description: "", keywords: [] };
  let size, meta;
  if (format === "SVG") {
    ({ meta, ...size } = await readSvg(file));
  } else {
    const bitmap = await createImageBitmap(file);
    size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    meta = await readMetadata(file).catch(() => blank);
  }
  const fromName = baseName(file.name).replace(/[-_]+/g, " ");
  return {
    ...meta,
    ...size,
    keywords: parseKeywords(meta.keywords.join(",")).slice(0, MAX_KEYWORDS),
    format,
    kind,
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
      batch_id: item.batchId ?? null,
      source_name: baseName(item.base),
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
