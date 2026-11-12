// Home's library covers, picked from the store itself: the most downloaded
// published asset of each type (newest first while downloads are level), so
// the cards change as the library grows. Free assets come first. Logo
// thumbnails carry the watermark when they aren't free, so only free logos
// qualify; the other types keep clean thumbnails at any license.
import { supabase } from "./supabaseClient";
import { publicUrl } from "./r2";

const TYPES = { icons: "icon", vectors: "vector", logos: "logo", footage: "footage", templates: "template" };
// icons are small marks, so their card shows a few of them together
const ICONS_SHOWN = 6;

async function pick(type, count) {
  let query = supabase
    .from("assets")
    .select("thumb_key")
    .eq("type", type)
    .eq("status", "published")
    .not("thumb_key", "is", null);
  if (type === "logo") query = query.eq("license", "free");
  const { data, error } = await query
    .order("license", { ascending: true })
    .order("downloads", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(count);
  if (error) throw error;
  return (data ?? []).map((row) => publicUrl(row.thumb_key));
}

// { vectors: [url], icons: [url, ...], ... }; a library with nothing to show
// is left out, and its card keeps the cover in data/categories.js
export async function fetchCovers() {
  const entries = await Promise.all(
    Object.entries(TYPES).map(async ([key, type]) => {
      const urls = await pick(type, key === "icons" ? ICONS_SHOWN : 1).catch(() => []);
      return [key, urls];
    })
  );
  return Object.fromEntries(entries.filter(([key, urls]) => urls.length >= (key === "icons" ? 3 : 1)));
}
