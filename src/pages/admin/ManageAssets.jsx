// Uploaded assets on /admin: find one, edit its details, hide or show it, or
// delete it. The search and filters run on the database, so they keep working
// with thousands of assets. Admins see every row (RLS); visitors only ever see
// published ones. Deleting removes the row first, then its files from R2.
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { deleteFromR2, publicUrl } from "../../lib/r2";
import { industries } from "../../data/logosData";
import { VECTOR_CATEGORY_OPTIONS } from "../../data/vectorCategories";
import { CATEGORIES } from "./adminCategories";
import { BACKGROUND_CATEGORIES, ELEMENT_CATEGORIES } from "./elementPublish";
import EditAsset from "./EditAsset";

const LABEL = { vector: "vectors", icon: "icons", logo: "logos", footage: "clips", template: "templates", element: "elements" };
const FIELDS = "id, code, ref_code, source_name, title, description, keywords, category, industry, style, license, price_cents, sold_at, status, thumb_key, preview_key, preview_video_key, files, created_at";
const PAGE_SIZE = 50;
const NO_FILTERS = { search: "", category: "", kind: "", month: "", license: "", status: "", sort: "newest" };

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// [value, label] pairs for the category filter
function categoryOptions(type) {
  if (type === "logo") return industries;
  if (type === "vector") return VECTOR_CATEGORY_OPTIONS;
  const list = type === "element"
    ? [...new Set([...ELEMENT_CATEGORIES, ...BACKGROUND_CATEGORIES])].sort()
    : CATEGORIES[type] ?? [];
  return list.map((c) => [c, capitalize(c)]);
}

// the last two years, newest first, as ["2026-11", "Nov 2026"]
function monthOptions() {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return [value, d.toLocaleDateString(undefined, { month: "short", year: "numeric" })];
  });
}

function loadAssets(type, filters, page) {
  let query = supabase.from("assets").select(FIELDS, { count: "exact" }).eq("type", type);

  // every word has to match somewhere; only letters and digits reach the
  // filter, as commas and brackets mean something to it
  filters.search
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter(Boolean)
    .forEach((word) => {
      query = query.or(
        `title.ilike.%${word}%,code.ilike.%${word}%,ref_code.ilike.%${word}%,source_name.ilike.%${word}%,keywords.cs.{${word.toLowerCase()}}`
      );
    });

  if (filters.category) query = query.eq(type === "logo" ? "industry" : "category", filters.category);
  if (filters.kind === "background") query = query.eq("style", "background");
  if (filters.kind === "element") query = query.neq("style", "background");
  if (filters.license) query = query.eq("license", filters.license);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.month) {
    const [year, month] = filters.month.split("-").map(Number);
    query = query
      .gte("created_at", new Date(year, month - 1, 1).toISOString())
      .lt("created_at", new Date(year, month, 1).toISOString());
  }

  query = filters.sort === "title"
    ? query.order("title", { ascending: true })
    : query.order("created_at", { ascending: filters.sort === "oldest" });

  return query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
}

function ManageAssets({ type = "vector", refreshKey }) {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(0);
  // bumped after a delete, so the page fills back up
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(null);
  // the id of the asset being edited
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  // reloads when the filters change and after each publish (refreshKey);
  // waits a moment while typing, so each letter isn't its own request
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      loadAssets(type, filters, page).then(({ data, count, error: e }) => {
        if (!alive) return;
        if (e) {
          setError(e.message);
          return;
        }
        setError(null);
        setRows(data);
        setTotal(count ?? 0);
      });
    }, filters.search ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [type, refreshKey, filters, page, reload]);

  const setFilter = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setPage(0);
  };

  const toggle = async (row) => {
    setBusy(row.id);
    const status = row.status === "published" ? "hidden" : "published";
    const { error: e } = await supabase.from("assets").update({ status }).eq("id", row.id);
    setBusy(null);
    if (e) setError(e.message);
    else setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status } : r)));
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.code} “${row.title}”? Its files are removed from storage too. This can't be undone.`)) return;
    setBusy(row.id);
    setError(null);
    const { error: e } = await supabase.from("assets").delete().eq("id", row.id);
    if (e) {
      setBusy(null);
      // 23503: a download record points at it; hide it instead so licenses stay valid
      setError(e.code === "23503" ? `${row.code} has been downloaded, so hide it instead of deleting.` : e.message);
      return;
    }
    const files = [
      // templates and Create elements are read by the editor, so they're public
      ...row.files.map((f) => [f.bucket ?? (type === "template" ? "public" : "private"), f.key]),
      ["public", row.thumb_key],
      ["public", row.preview_key],
      ["public", row.preview_video_key],
    ].filter(([, key]) => key);
    const unique = [...new Map(files.map((f) => [f.join("/"), f])).values()];
    await Promise.allSettled(unique.map(([bucket, key]) => deleteFromR2(bucket, key)));
    setBusy(null);
    setReload((n) => n + 1);
  };

  if (rows === null && !error) return <p className="ad-note">Loading uploaded {LABEL[type]}…</p>;

  const filtered = Object.keys(NO_FILTERS).some((k) => k !== "sort" && filters[k]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="ad-manage">
      <h2>Uploaded {LABEL[type]} <span>{total}</span></h2>

      <div className="ad-filters">
        <input
          type="search"
          className="ad-find"
          placeholder="Search code, title, file name or keyword"
          aria-label={`Search uploaded ${LABEL[type]}`}
          value={filters.search}
          onChange={setFilter("search")}
        />
        {type === "element" && (
          <select value={filters.kind} onChange={setFilter("kind")} aria-label="Type">
            <option value="">All types</option>
            <option value="element">Element</option>
            <option value="background">Background</option>
          </select>
        )}
        <select value={filters.category} onChange={setFilter("category")} aria-label={type === "logo" ? "Industry" : "Category"}>
          <option value="">{type === "logo" ? "All industries" : "All categories"}</option>
          {categoryOptions(type).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.month} onChange={setFilter("month")} aria-label="Upload month">
          <option value="">Any month</option>
          {monthOptions().map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.license} onChange={setFilter("license")} aria-label="License">
          <option value="">Any license</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
          {type === "logo" && <option value="exclusive">Exclusive</option>}
        </select>
        <select value={filters.status} onChange={setFilter("status")} aria-label="Status">
          <option value="">Any status</option>
          <option value="published">On the site</option>
          <option value="hidden">Hidden</option>
        </select>
        <select value={filters.sort} onChange={setFilter("sort")} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title A–Z</option>
        </select>
        {filtered && <button className="ad-clear" onClick={clearFilters}>Clear</button>}
      </div>

      {error && <p className="ad-error">{error}</p>}
      {rows?.length === 0 && (
        <p className="ad-note">{filtered ? "Nothing matches these filters." : `No ${LABEL[type]} uploaded yet.`}</p>
      )}
      <div className="ad-list">
        {rows?.map((row) => (
          <div className={`ad-item ad-row-item is-${row.status}`} key={row.id}>
            <div className={`ad-thumb ${type === "icon" || type === "element" ? "is-icon" : ""}`}>{row.thumb_key && <img src={publicUrl(row.thumb_key)} alt="" loading="lazy" />}</div>
            <div className="ad-fields">
              <strong>{row.title}</strong>
              <span className="ad-file">
                {row.ref_code && <b className="ad-ref">{row.ref_code}</b>}
                {row.code} · {capitalize(row.license)} ·{" "}
                {new Date(row.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <div className="ad-actions">
              <span className={`ad-pill is-${row.status}`}>{row.status === "published" ? "On the site" : "Hidden"}</span>
              <button onClick={() => setEditing(editing === row.id ? null : row.id)} disabled={busy === row.id}>
                Edit
              </button>
              <button onClick={() => toggle(row)} disabled={busy === row.id}>
                {row.status === "published" ? "Hide" : "Show"}
              </button>
              <button className="ad-delete" onClick={() => remove(row)} disabled={busy === row.id}>
                Delete
              </button>
            </div>
            {editing === row.id && (
              <EditAsset
                row={row}
                type={type}
                onCancel={() => setEditing(null)}
                onSaved={(changes) => {
                  setRows((list) => list.map((r) => (r.id === row.id ? { ...r, ...changes } : r)));
                  setEditing(null);
                }}
              />
            )}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="ad-pager">
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 0}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= pages}>Next</button>
        </div>
      )}
    </div>
  );
}

export default ManageAssets;
