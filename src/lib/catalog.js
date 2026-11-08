// The asset catalogue in Supabase, shaped like the trial data the library
// pages already use, so a page can show both side by side while the trial
// files are phased out. Visitors only ever receive published rows (RLS).
import { supabase } from "./supabaseClient";
import { publicUrl } from "./r2";

const orientationOf = (w, h) => (w === h ? "square" : w > h ? "landscape" : "portrait");
const mb = (bytes) => (bytes ? `${(bytes / 1_000_000).toFixed(1)} MB` : "");

export async function fetchPublished(type) {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("type", type)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

// a database row as a Vectors page item
export function toVector(row) {
  const file = (format) => row.files.find((f) => f.format === format);
  const eps = file("EPS");
  const jpg = file("JPG");
  const artboard = [row.width || jpg?.width || 1, row.height || jpg?.height || 1];
  return {
    // numeric and growing, so "Newest" sorts by publish time
    id: Date.parse(row.published_at || row.created_at),
    dbId: row.id,
    code: row.code,
    title: row.title,
    searchText: `${row.long_title ?? ""} ${row.description ?? ""}`.toLowerCase(),
    category: row.category || "other",
    license: row.license,
    image: publicUrl(row.thumb_key),
    preview: [jpg?.width || artboard[0], jpg?.height || artboard[1]],
    previewImage: publicUrl(row.preview_key),
    // originals live in the private bucket; signed download links come next
    sources: {
      EPS: { url: null, size: mb(eps?.bytes) },
      JPG: { url: null, size: mb(jpg?.bytes) },
    },
    files: row.files.map((f) => f.format),
    format: "EPS",
    artboard,
    orientation: row.orientation || orientationOf(artboard[0], artboard[1]),
    downloads: row.downloads,
    keywords: row.keywords ?? [],
  };
}

// Published icons and the sets they belong to, shaped like data/iconsData.js
export async function fetchIconCatalog() {
  const [iconRes, setRes] = await Promise.all([
    supabase
      .from("assets")
      .select("id, code, title, keywords, category, style, set_id, license, thumb_key, downloads, published_at, created_at")
      .eq("type", "icon")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1000),
    supabase
      .from("asset_sets")
      .select("id, name, style, license, description, created_at")
      .eq("type", "icon")
      .eq("status", "published")
      .order("created_at", { ascending: false }),
  ]);
  if (iconRes.error) throw iconRes.error;
  if (setRes.error) throw setRes.error;

  const icons = (iconRes.data ?? []).map((row) => ({
    id: Date.parse(row.published_at || row.created_at),
    dbId: row.id,
    code: row.code,
    name: row.title,
    image: publicUrl(row.thumb_key),
    keywords: row.keywords ?? [],
    category: row.category || "other",
    style: row.style || "glyph",
    setId: row.set_id,
    license: row.license,
    downloads: row.downloads,
  }));
  // a set shows only once it has a published icon
  const used = new Set(icons.map((i) => i.setId));
  const sets = (setRes.data ?? [])
    .filter((set) => used.has(set.id))
    .map((set) => ({
      id: set.id,
      name: set.name,
      style: set.style,
      license: set.license,
      description: set.description || "",
    }));
  return { icons, sets };
}
