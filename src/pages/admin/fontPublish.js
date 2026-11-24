// Fonts on /admin: one upload is one font, the owner's own typeface, sold
// per item as on Creative Market (not part of the subscription). The buyer's
// package is one ZIP, uploaded as it is (or made here from loose OTF, TTF,
// WOFF2 and license files) and kept in the private bucket. The site shows up
// to 8 preview pictures (the first is the cover); without any, a specimen is
// drawn from the font itself. The font file is never public.
import JSZip from "jszip";
import { supabase } from "../../lib/supabaseClient";
import { uploadToR2 } from "../../lib/r2";
import { makeImages } from "./vectorUpload";

export const FONT_EXTS = ["otf", "ttf", "woff2", "woff"];
export const LICENSE_EXTS = ["pdf", "txt", "md", "rtf"];
export const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];
export const FONT_ACCEPT = [...FONT_EXTS, ...LICENSE_EXTS, ...IMAGE_EXTS, "zip"].map((e) => `.${e}`).join(",");
export const MAX_PREVIEWS = 8;

// the license tiers, as font shops sell them, with starting prices in USD
export const FONT_TIERS = [
  ["desktop", "Desktop", 19],
  ["web", "Web", 39],
  ["app", "App & ebook", 79],
  ["extended", "Extended", 149],
];

export { FONT_CATEGORIES } from "../../data/fontCategories";

const extOf = (name) => name.split(".").pop().toLowerCase();
const baseOf = (path) => path.split("/").pop();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "font";
export const isLicense = (path) => LICENSE_EXTS.includes(extOf(path)) && /licen[cs]e|eula|terms/i.test(baseOf(path));

// What's inside a package, from its file paths (a ZIP's, or loose files'):
// the font files, the license, how many versions, as a short list for the
// description ("What's included").
export function describePackage(paths) {
  const files = paths.filter((p) => !p.endsWith("/") && !p.includes("__MACOSX") && !baseOf(p).startsWith("."));
  const fonts = files.filter((p) => FONT_EXTS.includes(extOf(p)));
  const formats = [...new Set(fonts.map((p) => extOf(p).toUpperCase()))];
  const licenses = files.filter(isLicense);
  // folders holding fonts: each a version or a weight
  const folders = new Set(fonts.map((p) => p.split("/").slice(0, -1).join("/")));
  const lines = [];
  if (formats.length) lines.push(`${fonts.length} font files (${formats.join(", ")})${folders.size > 1 ? ` in ${folders.size} folders` : ""}`);
  if (licenses.length) lines.push(`License (${licenses.map(baseOf).join(", ")})`);
  const other = files.length - fonts.length - licenses.length;
  if (other > 0) lines.push(`${other} more ${other === 1 ? "file" : "files"} (readme, previews)`);
  return {
    files,
    fonts,
    formats,
    hasLicense: licenses.length > 0,
    included: lines.length ? `What's included: ${lines.join(" · ")}.` : "",
  };
}

// a ZIP's paths and the font to read the name from (the "LATEST" folder's,
// else the last version's, a Regular first)
export async function readZip(zipFile) {
  const zip = await JSZip.loadAsync(zipFile);
  const paths = Object.keys(zip.files);
  const pack = describePackage(paths);
  const desktop = pack.fonts.filter((p) => ["otf", "ttf"].includes(extOf(p)));
  const ranked = [...desktop].sort((a, b) => {
    const score = (p) => (/latest/i.test(p) ? 2 : 0) + (/regular|book|normal/i.test(baseOf(p)) ? 1 : 0);
    return score(b) - score(a) || b.localeCompare(a, undefined, { numeric: true });
  });
  const chosen = ranked[0];
  const font = chosen ? new File([await zip.file(chosen).async("blob")], baseOf(chosen)) : null;
  // its preview pictures (a "preview" folder's first), shown on the site
  const images = pack.files.filter((p) => IMAGE_EXTS.includes(extOf(p)))
    .sort((a, b) => Number(!/preview/i.test(b)) - Number(!/preview/i.test(a)) || a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, MAX_PREVIEWS);
  const previews = [];
  for (const p of images) {
    const type = extOf(p) === "png" ? "image/png" : extOf(p) === "webp" ? "image/webp" : "image/jpeg";
    previews.push(new File([await zip.file(p).async("blob")], baseOf(p), { type }));
  }
  return { ...pack, font, previews };
}

// a package with license files added to it (dropped beside its ZIP)
export function withAdded(pack, added) {
  return describePackage([...pack.files, ...added.map((f) => f.name)]);
}

// what the upload still lacks before it can go up
export function missingParts(item) {
  const lacks = [];
  if (!item.pack?.formats.some((f) => f === "OTF" || f === "TTF")) lacks.push("an OTF or TTF font");
  if (!item.pack?.hasLicense) lacks.push("a license file (named license, licence or EULA: drop it here and it goes into the ZIP)");
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

export async function publishFont(item, onStep) {
  // the pictures: the uploaded previews (the first is the cover), or a
  // specimen drawn from the font
  onStep("Making the previews", 0);
  const sources = item.previews.length ? item.previews : [await drawSpecimen(item.font, item.title)];
  const pictures = [];
  for (const source of sources.slice(0, MAX_PREVIEWS)) pictures.push(await makeImages(source, false));

  // the buyer's package: the ZIP as uploaded, or one made from loose files
  let pack = item.zip;
  if (pack && item.added?.length) {
    // the license files dropped beside it go into the ZIP, next to the fonts
    // (inside its one top folder when it has one)
    onStep("Adding the license to the ZIP", 0);
    const zip = await JSZip.loadAsync(pack);
    const tops = new Set(Object.keys(zip.files).filter((p) => !p.includes("__MACOSX")).map((p) => p.split("/")[0]));
    const root = tops.size === 1 && zip.files[`${[...tops][0]}/`] ? `${[...tops][0]}/` : "";
    for (const file of item.added) zip.file(`${root}${file.name}`, file);
    pack = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  }
  if (!pack) {
    onStep("Packing the ZIP", 0);
    const zip = new JSZip();
    const folder = zip.folder(slug(item.title));
    for (const file of item.loose) folder.file(file.name, file);
    pack = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  }

  const prices = Object.fromEntries(FONT_TIERS.map(([id]) => [id, Number(item.prices[id]) || null]).filter(([, p]) => p));
  const ext = (blob) => ({ "image/webp": "webp", "image/png": "png" }[blob.type] ?? "jpg");

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = `KD-FN-${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;
    const dir = `fonts/${code}`;
    const steps = [
      { bucket: "private", key: `${dir}/${slug(item.title)}.zip`, file: pack, contentType: "application/zip" },
      { bucket: "public", key: `${dir}/thumb.${ext(pictures[0].thumb)}`, file: pictures[0].thumb, contentType: pictures[0].thumb.type },
      ...pictures.map((p, i) => ({ bucket: "public", key: `${dir}/preview-${i + 1}.${ext(p.preview)}`, file: p.preview, contentType: p.preview.type })),
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
    const previews = steps.slice(2);
    const { error } = await supabase.from("assets").insert({
      code,
      batch_id: item.batchId ?? null,
      source_name: item.zip?.name ?? item.title,
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
      preview_key: previews[0].key,
      // every preview picture, the cover first, for the gallery
      gallery: previews.map((p, i) => ({ key: p.key, width: pictures[i].width, height: pictures[i].height })),
      files: [{ format: "ZIP", key: steps[0].key, bytes: pack.size, label: "Font package", contents: item.pack.files.map(baseOf) }],
      width: pictures[0].width,
      height: pictures[0].height,
      orientation: pictures[0].width === pictures[0].height ? "square" : pictures[0].width > pictures[0].height ? "landscape" : "portrait",
    });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't find a free asset code, try again");
}
