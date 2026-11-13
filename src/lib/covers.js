// Home's library covers, picked from the store itself: the most downloaded
// published asset of each type (newest first while downloads are level), so
// the cards change as the library grows. Free assets come first. Logo
// thumbnails carry the watermark when they aren't free, so only free logos
// qualify; the other types keep clean thumbnails at any license.
import { supabase } from "./supabaseClient";
import { publicUrl } from "./r2";

const TYPES = { icons: "icon", vectors: "vector", logos: "logo", footage: "footage", templates: "template" };

// covers chosen by hand (asset codes), ahead of the automatic pick; a code
// that is hidden or deleted is simply skipped
const PINNED = {
  vectors: ["KD-VC-2323081"],
  footage: ["KD-FT-4346269"],
};

// clips the Footage card plays in turn on hover, chosen by hand; the
// automatic pick fills in when there are fewer than REEL_MIN
const REEL = ["KD-FT-4346269", "KD-FT-6181298", "KD-FT-2904492", "KD-FT-6181959"];
const REEL_MIN = 2;
const REEL_MAX = 4;
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

async function byCode(codes, field) {
  if (!codes.length) return [];
  const { data, error } = await supabase
    .from("assets")
    .select(`code, ${field}`)
    .in("code", codes)
    .eq("status", "published")
    .not(field, "is", null);
  if (error) throw error;
  // in the order they were chosen
  return codes.map((c) => data.find((row) => row.code === c)).filter(Boolean).map((row) => publicUrl(row[field]));
}

async function reel() {
  const chosen = await byCode(REEL, "preview_video_key");
  if (chosen.length >= REEL_MIN) return chosen.slice(0, REEL_MAX);
  const { data } = await supabase
    .from("assets")
    .select("preview_video_key")
    .eq("type", "footage")
    .eq("status", "published")
    .not("preview_video_key", "is", null)
    .order("downloads", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(REEL_MAX);
  return [...new Set([...chosen, ...(data ?? []).map((row) => publicUrl(row.preview_video_key))])].slice(0, REEL_MAX);
}

// { vectors: [url], icons: [url, ...], ..., reel: [video url, ...] }; a
// library with nothing to show is left out, and its card keeps the cover in
// data/categories.js
export async function fetchCovers() {
  const entries = await Promise.all(
    Object.entries(TYPES).map(async ([key, type]) => {
      const pinned = await byCode(PINNED[key] ?? [], "thumb_key").catch(() => []);
      const urls = pinned.length ? pinned : await pick(type, key === "icons" ? ICONS_SHOWN : 1).catch(() => []);
      return [key, urls];
    })
  );
  const covers = Object.fromEntries(entries.filter(([key, urls]) => urls.length >= (key === "icons" ? 3 : 1)));
  const clips = await reel().catch(() => []);
  if (clips.length >= REEL_MIN) covers.reel = clips;
  return covers;
}
