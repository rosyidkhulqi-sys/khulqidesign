// Published assets from Supabase, shaped for use by the library pages.
import { supabase } from "./supabaseClient";
import { publicUrl } from "./r2";
import { normalizeVectorCategory } from "../data/vectorCategories";
import { normalizeElementCategory } from "../data/elementCategories";

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

// a database row as a part for the Create editor: an element or a background
export function toCreatePart(row) {
  const file = row.files[0];
  return {
    id: row.code,
    url: publicUrl(file.key),
    thumb: publicUrl(row.thumb_key),
    type: file.format.toLowerCase(),
    kind: row.style === "background" ? "background" : "element",
    category: row.style === "background" ? row.category || "other" : normalizeElementCategory(row.category),
    name: row.title,
    keywords: row.keywords ?? [],
  };
}

// One page of a library, searched and filtered by the database, so a library
// of any size stays fast. Every word must match the start of a word in the
// title, keywords or the file's own title and description, in any order;
// words that only name the kind of asset ("vector") are left out.
//   narrow(query): adds the page's own filters
export async function searchCatalog(type, { text = "", kindWords = [], narrow, sort = "popular", page = 1, perPage = 24 } = {}) {
  let query = supabase.from("assets").select("*", { count: "exact" }).eq("type", type).eq("status", "published");
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w && !kindWords.includes(w));
  if (words.length) query = query.textSearch("search", words.map((w) => `${w}:*`).join(" & "), { config: "simple" });
  if (narrow) query = narrow(query);
  query = sort === "popular"
    ? query.order("downloads", { ascending: false }).order("published_at", { ascending: false })
    : query.order("published_at", { ascending: false });
  const from = (page - 1) * perPage;
  const { data, count, error } = await query.range(from, from + perPage - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
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
    category: normalizeVectorCategory(row.category),
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

// Published icons and the sets they belong to, ready for the library pages.
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

// a database row as a Footage page clip
export function toClip(row) {
  const w = row.width || 1920;
  const h = row.height || 1080;
  const mp4 = row.files.find((f) => f.format === "MP4") ?? row.files[0];
  return {
    id: Date.parse(row.published_at || row.created_at),
    dbId: row.id,
    code: row.code,
    title: row.title,
    searchText: `${row.long_title ?? ""} ${row.description ?? ""}`.toLowerCase(),
    category: row.category || "other",
    license: row.license,
    image: publicUrl(row.thumb_key),
    // the hover and detail video is the light, watermarked preview
    file: publicUrl(row.preview_video_key),
    previewImage: publicUrl(row.preview_key),
    size: [w, h],
    sizeLabel: mb(mp4?.bytes),
    resolution: Math.max(w, h) >= 3840 ? "4K" : "HD",
    fps: row.fps ? Math.round(Number(row.fps)) : null,
    duration: Math.round(Number(row.duration_s) || 0),
    orientation: w === h ? "square" : w > h ? "horizontal" : "vertical",
    loop: false,
    downloads: row.downloads,
    keywords: row.keywords ?? [],
    // originals sit in the private bucket; signed download links come next
    originals: row.files,
  };
}

// a database row as a Logos page item
export function toLogo(row) {
  return {
    id: Date.parse(row.published_at || row.created_at),
    dbId: row.id,
    code: row.code,
    title: row.title,
    searchText: `${row.long_title ?? ""} ${row.description ?? ""}`.toLowerCase(),
    industry: row.industry || "business",
    style: row.style || "abstract",
    license: row.license,
    price: row.price_cents ? row.price_cents / 100 : null,
    sold: Boolean(row.sold_at),
    // the buyer gets the files; everyone else sees it as sold
    soldTo: row.sold_to ?? null,
    // the watermark is in these pixels for Premium and Exclusive logos
    image: publicUrl(row.thumb_key),
    previewImage: publicUrl(row.preview_key),
    downloads: row.downloads,
    keywords: row.keywords ?? [],
    originals: row.files,
  };
}
