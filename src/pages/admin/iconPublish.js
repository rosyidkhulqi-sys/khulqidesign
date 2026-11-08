// Icons on /admin: SVG files grouped into sets. A set fixes the style
// (outline, glyph, flat, gradient), the category and default license, and
// keywords every icon in it is found by. Each SVG is cleaned the same way
// the icon editor cleans it (no scripts, handlers or javascript: links),
// then the original goes to private-files and the cleaned copy, which the
// editor and the grid read, to public-files.
import { supabase } from "../../lib/supabaseClient";
import { uploadToR2 } from "../../lib/r2";
import { loadIconSvg } from "../../lib/iconEditor";

export const ICON_STYLES = ["outline", "glyph", "flat", "gradient"];
export const ICON_CATEGORIES = ["business", "social", "ui", "holiday", "nature", "food", "education", "medical", "travel", "other"];

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "icon";

// "hot sale.svg" -> "Hot sale"; "wallet_icon-2.svg" -> "Wallet icon 2"
export function nameFromFile(fileName) {
  const base = fileName.replace(/\.svg$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1).toLowerCase() : "Icon";
}

export const splitKeywords = (text) =>
  [...new Set(text.split(/[,;\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean))];

// read and clean one SVG; also guess its style from what it paints
export async function readSvg(file) {
  const url = URL.createObjectURL(file);
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
    return { clean, style, colors: source.colors.length, width: Math.round(w) || 512, height: Math.round(h) || 512 };
  } finally {
    URL.revokeObjectURL(url);
  }
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
  const keywords = [...new Set([...item.keywords, ...(set.keywords ?? []), set.style, "icon"])];

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode("KD-IC");
    const folder = `icons/${code}`;
    const name = slug(item.name);
    const original = { bucket: "private", key: `${folder}/${name}.svg`, file: item.file, contentType: "image/svg+xml" };
    const shown = { bucket: "public", key: `${folder}/icon.svg`, file: cleanBlob, contentType: "image/svg+xml" };

    onStep("Uploading SVG", 0);
    await uploadToR2({ ...original, onProgress: (p) => onStep("Uploading SVG", p * 0.5) });
    await uploadToR2({ ...shown, onProgress: (p) => onStep("Uploading preview", 0.5 + p * 0.5) });

    onStep("Saving", 1);
    const { error } = await supabase.from("assets").insert({
      code,
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
