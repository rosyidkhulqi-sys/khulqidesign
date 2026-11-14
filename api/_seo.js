// Shared by the Vercel functions that serve search engines: reading the
// published catalog with the public (publishable) key, and safe HTML.
// Files starting with "_" in /api are helpers, not endpoints.

export const SITE = "https://khulqidesign.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://xxikvdbajqygjsehrldi.supabase.co";
// public by design: the same key ships in the browser bundle
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_IxJSv34yZhNyGkgWbvYAjg_UFmo6CDO";
const CDN = process.env.VITE_R2_PUBLIC_URL || "https://cdn.khulqidesign.com";

// library page -> asset type in the database
export const PAGE_TYPES = { icons: "icon", vectors: "vector", logos: "logo", footage: "footage" };

export const cdn = (key) => (key ? `${CDN}/${key.split("/").map(encodeURIComponent).join("/")}` : null);

export const slugify = (text = "") =>
  text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

// the same address the site gives the asset (src/lib/router.js assetPath)
export const assetUrl = (page, row) =>
  `${SITE}/${page}/${[slugify(row.title), row.code.toLowerCase()].filter(Boolean).join("-")}`;

// GET rows from the database's REST API; Range pages through big tables
export async function rest(path, { from = 0, to = 999 } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: `${from}-${to}` },
  });
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  return res.json();
}

export const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// JSON inside <script>: "<" can't close the tag
export const jsonLd = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
