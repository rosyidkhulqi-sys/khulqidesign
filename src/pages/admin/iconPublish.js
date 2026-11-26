// Icons on /admin: SVG files grouped into sets. A set fixes the style
// (outline, glyph, flat, gradient), the category and default license, and
// keywords every icon in it is found by. Each SVG is cleaned the same way
// the icon editor cleans it (no scripts, handlers or javascript: links),
// then the original goes to private-files and the cleaned copy, which the
// editor and the grid read, to public-files.
import { supabase } from "../../lib/supabaseClient";
import { insertAsset } from "../../lib/insertAsset";
import { signUploads, uploadToR2 } from "../../lib/r2";
import { loadIconSvg } from "../../lib/iconEditor";
import { svgMetadata } from "./elementPublish";

export const ICON_STYLES = ["outline", "glyph", "flat", "gradient", "hand-drawn"];
export const ICON_CATEGORIES = ["business", "social", "ui", "holiday", "nature", "food", "education", "medical", "travel", "other"];

// words that say nothing about what an icon shows: the page, the style
// filter and the file type already do
export const GENERIC_ICON_WORDS = new Set([
  "icon", "icons", "outline", "outlined", "glyph", "solid", "filled", "line icon",
  "vector", "vectors", "svg", "symbol", "pictogram", "illustration", "doodle icon",
]);

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "icon";

// "hot sale.svg" -> "Hot sale"; "wallet_icon-2.svg" -> "Wallet icon 2"
export function nameFromFile(fileName) {
  const base = fileName.replace(/\.svg$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1).toLowerCase() : "Icon";
}

export const splitKeywords = (text) =>
  [...new Set(text.split(/[,;\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean))];

// the title and keywords written into the SVG (Dublin Core in its
// <metadata>, as KD Create, Illustrator or Inkscape write them), as for
// elements; nothing when the file has none
async function svgMeta(file) {
  try {
    const svg = new DOMParser().parseFromString(await file.text(), "image/svg+xml").documentElement;
    if (svg.nodeName !== "svg") return { title: "", keywords: [] };
    const m = svgMetadata(svg);
    return { title: m.longTitle, keywords: splitKeywords(m.keywords.join(",")) };
  } catch {
    return { title: "", keywords: [] };
  }
}

// read and clean one SVG; also guess its style from what it paints
export async function readSvg(file) {
  const url = URL.createObjectURL(file);
  const meta = await svgMeta(file);
  try {
    const source = await loadIconSvg(url);
    const markup = source.inner;
    let style = "glyph";
    if (/<(linear|radial)Gradient\b/i.test(markup)) style = "gradient";
    else if (source.colors.length > 1) style = "flat";
    else if (/\bstroke(="|:)\s*(?!none)/i.test(markup) && !/\bfill(="|:)\s*(?!none)/i.test(markup)) style = "outline";
    const clean =
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${source.viewBox}">` +
      markup +
      `</svg>`;
    const [, , w, h] = source.viewBox.split(/[\s,]+/).map(Number);
    return { clean, style, colors: source.colors.length, width: Math.round(w) || 512, height: Math.round(h) || 512, meta };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// the icons of a set, to copy their names and keywords to the same icons in
// another style; matched by file name
export async function iconsOfSet(setId) {
  const { data, error } = await supabase
    .from("assets")
    .select("title, keywords, source_name")
    .eq("set_id", setId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listIconSets() {
  const { data, error } = await supabase
    .from("asset_sets")
    .select("id, code, name, style, category, license, keywords, description")
    .eq("type", "icon")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const newCode = (prefix) => `${prefix}-${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;

// where an icon's two files go in R2
const iconKeys = (code, name) => ({ original: `icons/${code}/${slug(name)}.svg`, shown: `icons/${code}/icon.svg` });

// Codes and signed upload links for a whole batch at once, before the
// icons go up: one call to r2-sign instead of two per icon. Returns a plan
// per item key ({ code, urls }); an icon without one signs its own links.
export async function planIcons(items) {
  const plans = {};
  const files = [];
  for (const item of items) {
    const code = newCode("KD-IC");
    const keys = iconKeys(code, item.name.trim() || "Icon");
    plans[item.key] = { code, urls: {} };
    files.push({ bucket: "private", key: keys.original, contentType: "image/svg+xml", item: item.key });
    files.push({ bucket: "public", key: keys.shown, contentType: "image/svg+xml", item: item.key });
  }
  const urls = await signUploads(files);
  for (const f of files) plans[f.item].urls[f.key] = urls[f.key];
  return plans;
}

export async function createIconSet(set) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("asset_sets")
      .insert({
        code: newCode("KD-IS"),
        type: "icon",
        status: "published",
        name: set.name.trim(),
        style: set.style,
        category: set.category,
        license: set.license,
        description: set.description.trim() || null,
        keywords: splitKeywords(set.keywords),
      })
      .select("id, code, name, style, category, license, keywords, description")
      .single();
    if (!error) return data;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't find a free set code, try again");
}

// upload one icon into a set and publish it
export async function publishIcon(item, set, onStep) {
  const svg = item.svg ?? (await readSvg(item.file));
  const cleanBlob = new Blob([svg.clean], { type: "image/svg+xml" });
  // what the icon shows, as on The Noun Project: no "icon", "outline" or
  // "vector" (the Icons page and its style filter already say that)
  // only the icon's own words: the set's keywords stay on the set, or every
  // icon would match them ("user" finding a ticket and a cloud)
  const keywords = [...new Set(item.keywords)].filter((k) => !GENERIC_ICON_WORDS.has(k.toLowerCase()));

  for (let attempt = 0; attempt < 3; attempt++) {
    // the first try uses the code and links prepared for the whole batch
    const planned = attempt === 0 ? item.plan : null;
    const code = planned?.code ?? newCode("KD-IC");
    const { original: originalKey, shown: shownKey } = iconKeys(code, item.name);
    const original = { bucket: "private", key: originalKey, file: item.file, contentType: "image/svg+xml", signedUrl: planned?.urls?.[originalKey] };
    const shown = { bucket: "public", key: shownKey, file: cleanBlob, contentType: "image/svg+xml", signedUrl: planned?.urls?.[shownKey] };

    // both files at once
    onStep("Uploading", 0);
    const sent = [0, 0];
    const progress = (i) => (p) => { sent[i] = p; onStep("Uploading", (sent[0] + sent[1]) / 2); };
    await Promise.all([
      uploadToR2({ ...original, onProgress: progress(0) }),
      uploadToR2({ ...shown, onProgress: progress(1) }),
    ]);

    onStep("Saving", 1);
    const error = await insertAsset({
      code,
      batch_id: item.batchId ?? null,
      source_name: item.file.name.replace(/\.svg$/i, ""),
      type: "icon",
      status: "published",
      title: item.name.trim(),
      keywords,
      category: set.category,
      style: set.style,
      set_id: set.id,
      license: item.license,
      thumb_key: shown.key,
      files: [{ format: "SVG", key: original.key, bytes: item.file.size, width: svg.width, height: svg.height }],
      width: svg.width,
      height: svg.height,
      orientation: "square",
    });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't find a free asset code, try again");
}
