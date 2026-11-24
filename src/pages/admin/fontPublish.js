// Fonts on /admin: one upload is one font family, the owner's own typeface,
// sold per item as on Creative Market (not part of the subscription). The
// OTF, TTF and WOFF2 files and the license file go to the buyer as one ZIP
// in the private bucket; the site shows a specimen picture drawn here from
// the font itself, so the font file is never public.
import JSZip from "jszip";
import { supabase } from "../../lib/supabaseClient";
import { uploadToR2 } from "../../lib/r2";
import { makeImages } from "./vectorUpload";

export const FONT_EXTS = ["otf", "ttf", "woff2", "woff"];
export const LICENSE_EXTS = ["pdf", "txt", "md", "rtf"];
export const FONT_ACCEPT = [...FONT_EXTS, ...LICENSE_EXTS].map((e) => `.${e}`).join(",");

// the license tiers, as font shops sell them, with starting prices in USD
export const FONT_TIERS = [
  ["desktop", "Desktop", 19],
  ["web", "Web", 39],
  ["app", "App & ebook", 79],
  ["extended", "Extended", 149],
];

export const FONT_CATEGORIES = [
  ["sans-serif", "Sans serif"],
  ["serif", "Serif"],
  ["display", "Display"],
  ["script", "Script"],
  ["handwritten", "Handwritten"],
  ["monospace", "Monospace"],
];

const extOf = (name) => name.split(".").pop().toLowerCase();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "font";

// the dropped files sorted into fonts and license files
export function sortFontFiles(fileList) {
  const fonts = [];
  const licenses = [];
  for (const file of fileList) {
    const ext = extOf(file.name);
    if (FONT_EXTS.includes(ext)) fonts.push(file);
    else if (LICENSE_EXTS.includes(ext)) licenses.push(file);
  }
  return { fonts, licenses };
}

// what the package still lacks before it can go up
export function missingParts({ fonts, licenses }) {
  const exts = new Set(fonts.map((f) => extOf(f.name)));
  const lacks = [];
  if (!exts.has("otf") && !exts.has("ttf")) lacks.push("an OTF or TTF");
  if (!exts.has("woff2")) lacks.push("a WOFF2");
  if (!licenses.length) lacks.push("the license file");
  return lacks;
}

// The family and style names written in an OTF or TTF ('name' table, IDs 1
// and 2; the typographic names 16 and 17 first when present). Null when the
// file can't be read (a WOFF2 is compressed, so it's skipped).
export async function readFontNames(file) {
  const ext = extOf(file.name);
  if (ext !== "otf" && ext !== "ttf") return null;
  const view = new DataView(await file.arrayBuffer());
  const tables = view.getUint16(4);
  let nameOffset = -1;
  for (let i = 0; i < tables; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
    if (tag === "name") nameOffset = view.getUint32(at + 8);
  }
  if (nameOffset < 0) return null;
  const count = view.getUint16(nameOffset + 2);
  const strings = nameOffset + view.getUint16(nameOffset + 4);
  const found = {};
  for (let i = 0; i < count; i++) {
    const at = nameOffset + 6 + i * 12;
    const platform = view.getUint16(at);
    const nameId = view.getUint16(at + 6);
    const length = view.getUint16(at + 8);
    const offset = strings + view.getUint16(at + 10);
    if (![1, 2, 16, 17].includes(nameId) || found[nameId]) continue;
    let text = "";
    if (platform === 3 || platform === 0) {
      // UTF-16 big-endian
      for (let j = 0; j < length; j += 2) text += String.fromCharCode(view.getUint16(offset + j));
    } else if (platform === 1) {
      for (let j = 0; j < length; j++) text += String.fromCharCode(view.getUint8(offset + j));
    }
    if (text.trim()) found[nameId] = text.trim();
  }
  const family = found[16] || found[1];
  return family ? { family, style: found[17] || found[2] || "Regular" } : null;
}

// The specimen: the family name large, the alphabet and numbers below, drawn
// with the font itself on the site's light card color.
async function drawSpecimen(fontFile, family) {
  const face = new FontFace(`kd-specimen-${Date.now()}`, await fontFile.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  try {
    const w = 2400;
    const h = 1600;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0b0b0c";
    ctx.textBaseline = "alphabetic";
    const font = (size) => `${size}px "${face.family}"`;
    // the name as big as fits the width
    let size = 360;
    ctx.font = font(size);
    while (ctx.measureText(family).width > w - 320 && size > 80) {
      size -= 10;
      ctx.font = font(size);
    }
    ctx.fillText(family, 160, 640);
    ctx.font = font(120);
    ctx.fillText("Aa Bb Cc Dd Ee Ff Gg", 160, 960, w - 320);
    ctx.font = font(84);
    ctx.fillText("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 160, 1160, w - 320);
    ctx.fillText("abcdefghijklmnopqrstuvwxyz", 160, 1290, w - 320);
    ctx.fillText("0123456789 !?&@#", 160, 1420, w - 320);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("This browser couldn't draw the specimen");
    return blob;
  } finally {
    document.fonts.delete(face);
  }
}

// the font the specimen is drawn with: a Regular OTF/TTF, else the first
function specimenFont(fonts) {
  const desktop = fonts.filter((f) => ["otf", "ttf"].includes(extOf(f.name)));
  return desktop.find((f) => /regular|book|normal/i.test(f.name)) ?? desktop[0] ?? fonts[0];
}

export async function publishFont(item, onStep) {
  onStep("Drawing the specimen", 0);
  const specimen = await drawSpecimen(specimenFont(item.fonts), item.title);
  const images = await makeImages(specimen, false);

  onStep("Packing the ZIP", 0);
  const zip = new JSZip();
  const folder = zip.folder(slug(item.title));
  for (const file of [...item.fonts, ...item.licenses]) folder.file(file.name, file);
  const pack = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

  const prices = Object.fromEntries(FONT_TIERS.map(([id]) => [id, Number(item.prices[id]) || null]).filter(([, p]) => p));

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = `KD-FN-${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;
    const dir = `fonts/${code}`;
    const ext = (blob) => ({ "image/webp": "webp", "image/png": "png" }[blob.type] ?? "jpg");
    const steps = [
      { bucket: "private", key: `${dir}/${slug(item.title)}.zip`, file: pack, contentType: "application/zip" },
      { bucket: "public", key: `${dir}/thumb.${ext(images.thumb)}`, file: images.thumb, contentType: images.thumb.type },
      { bucket: "public", key: `${dir}/preview.${ext(images.preview)}`, file: images.preview, contentType: images.preview.type },
    ];
    const total = steps.reduce((sum, s) => sum + s.file.size, 0);
    const sent = steps.map(() => 0);
    await Promise.all(steps.map((step, i) => uploadToR2({
      ...step,
      onProgress: (p) => {
        sent[i] = p * step.file.size;
        onStep("Uploading", sent.reduce((a, b) => a + b, 0) / total);
      },
    })));

    onStep("Saving", 1);
    const { error } = await supabase.from("assets").insert({
      code,
      batch_id: item.batchId ?? null,
      source_name: item.title,
      type: "font",
      status: "published",
      title: item.title,
      description: item.description || null,
      keywords: item.keywords,
      category: item.category,
      // sold per item at the tier prices; a Premium plan doesn't unlock it
      license: "paid",
      prices,
      thumb_key: steps[1].key,
      preview_key: steps[2].key,
      files: [{
        format: "ZIP",
        key: steps[0].key,
        bytes: pack.size,
        label: "Font package",
        contents: [...item.fonts, ...item.licenses].map((f) => f.name),
      }],
      width: images.width,
      height: images.height,
      orientation: "landscape",
    });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't find a free asset code, try again");
}
