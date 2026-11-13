// Uploaded assets on /admin: find one, edit its details, hide or show it, or
// delete it. The search and filters run on the database, so they keep working
// with thousands of assets. Admins see every row (RLS); visitors only ever see
// published ones. Deleting removes the row first, then its files from R2.
import { useEffect, useState } from "react";
import { askConfirm } from "../../lib/confirm";
import { supabase } from "../../lib/supabaseClient";
import { publicUrl } from "../../lib/r2";
import { industries } from "../../data/logosData";
import { VECTOR_CATEGORY_OPTIONS, vectorCategoryStorageValues } from "../../data/vectorCategories";
import {
  backgroundCategoryLabel,
  elementCategoryLabel,
  elementCategoryStorageValues,
} from "../../data/elementCategories";
import { CATEGORIES } from "./adminCategories";
import { BACKGROUND_CATEGORIES, ELEMENT_CATEGORIES } from "./elementPublish";
import EditAsset from "./EditAsset";
import ManageIconSets from "./ManageIconSets";
import ManageBatches from "./ManageBatches";
import { deleteAsset } from "./batches";

const LABEL = { vector: "vectors", icon: "icons", logo: "logos", footage: "clips", template: "templates", element: "elements" };
const FIELDS = "id, code, ref_code, source_name, title, description, keywords, category, industry, style, license, price_cents, sold_at, status, thumb_key, preview_key, preview_video_key, files, created_at, batch_id, batch:upload_batches(name)";
const PAGE_SIZE = 50;
const NO_FILTERS = { search: "", batch: "", category: "", kind: "", month: "", license: "", status: "", sort: "newest" };

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// [value, label] pairs for the category filter
function categoryOptions(type, kind = "") {
  if (type === "logo") return industries;
  if (type === "vector") return VECTOR_CATEGORY_OPTIONS;
  const list = type === "element"
    ? kind === "background"
      ? BACKGROUND_CATEGORIES
      : kind === "element"
        ? ELEMENT_CATEGORIES
        : [...new Set([...ELEMENT_CATEGORIES, ...BACKGROUND_CATEGORIES])]
    : CATEGORIES[type] ?? [];
  if (type === "element") {
    return list.map((c) => [c, BACKGROUND_CATEGORIES.includes(c) ? backgroundCategoryLabel(c) : elementCategoryLabel(c)]);
  }
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

  if (filters.category) {
    if (type === "logo") query = query.eq("industry", filters.category);
    else if (type === "vector") query = query.in("category", vectorCategoryStorageValues(filters.category));
    else if (type === "element" && filters.category === "graphics" && filters.kind !== "background") {
      query = query.in("category", elementCategoryStorageValues(filters.category));
    }
    else query = query.eq("category", filters.category);
  }
  // an element-only category means elements, even with "All types"
  if (type === "element" && !filters.kind && ELEMENT_CATEGORIES.includes(filters.category)) {
    query = query.neq("style", "background");
  }
  if (filters.kind === "background") query = query.eq("style", "background");
  if (filters.kind === "element") query = query.neq("style", "background");
  if (filters.batch) query = query.eq("batch_id", filters.batch);
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

// batchId: show one batch only (inside the Batches view), without the
// heading and the batch filter
export function ManageAssetRows({ type = "vector", refreshKey, batchId = null, embedded = false }) {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const blank = batchId ? { ...NO_FILTERS, batch: batchId } : NO_FILTERS;
  const [filters, setFilters] = useState(blank);
  // this type's batches, newest first, for the batch filter
  const [batches, setBatches] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase
      .from("upload_batches")
      .select("id, name")
      .eq("type", type)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => alive && setBatches(data ?? []));
    return () => {
      alive = false;
    };
  }, [type, refreshKey]);
  const [page, setPage] = useState(0);
  // bumped after a delete, so the page fills back up
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(null);
  // ticked rows on this page, for hiding, showing or deleting together
  const [picked, setPicked] = useState(() => new Set());
  const [bulk, setBulk] = useState(null);
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
        setPicked(new Set());
      });
    }, filters.search ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [type, refreshKey, filters, page, reload]);

  const setFilter = (key) => (e) => {
    const value = e.target.value;
    setFilters((f) => ({ ...f, [key]: value, ...(key === "kind" ? { category: "" } : {}) }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(blank);
    setPage(0);
  };

  const pick = (id) =>
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pickPage = () =>
    setPicked((set) => (rows && set.size === rows.length ? new Set() : new Set(rows?.map((r) => r.id))));

  const bulkStatus = async (status) => {
    const ids = [...picked];
    setBulk(status === "hidden" ? "Hiding…" : "Showing…");
    setError(null);
    const { error: e } = await supabase.from("assets").update({ status }).in("id", ids);
    setBulk(null);
    if (e) {
      setError(e.message);
      return;
    }
    setRows((list) => list.map((r) => (picked.has(r.id) ? { ...r, status } : r)));
    setPicked(new Set());
  };

  const bulkDelete = async () => {
    const chosen = rows.filter((r) => picked.has(r.id));
    const sure = await askConfirm({
      title: `Delete ${chosen.length} ${chosen.length === 1 ? "file" : "files"}?`,
      message: "They and their files are removed from storage. This can't be undone.",
      confirmLabel: `Delete ${chosen.length}`,
    });
    if (!sure) return;
    setError(null);
    let kept = 0;
    for (let i = 0; i < chosen.length; i++) {
      setBulk(`Deleting ${i + 1} of ${chosen.length}…`);
      try {
        if ((await deleteAsset(chosen[i], type)) === "hidden") kept += 1;
      } catch (e) {
        setError(e.message);
        break;
      }
    }
    if (kept) setError(`${kept} had been downloaded, so ${kept === 1 ? "it was" : "they were"} hidden instead of deleted.`);
    setBulk(null);
    setReload((n) => n + 1);
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
    const sure = await askConfirm({
      title: `Delete ${row.code}?`,
      message: `“${row.title}” and its files are removed from storage. This can't be undone.`,
    });
    if (!sure) return;
    setBusy(row.id);
    setError(null);
    try {
      const result = await deleteAsset(row, type);
      // a download record points at it, so it was hidden to keep licenses valid
      if (result === "hidden") setError(`${row.code} has been downloaded, so it was hidden instead of deleted.`);
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
    setReload((n) => n + 1);
  };

  if (rows === null && !error) return <p className="ad-note">Loading uploaded {LABEL[type]}…</p>;

  const filtered = Object.keys(NO_FILTERS).some((k) => k !== "sort" && filters[k] !== blank[k]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={batchId || embedded ? "ad-batch-files" : "ad-manage"}>
      {!batchId && !embedded && <h2>Uploaded {LABEL[type]} <span>{total}</span></h2>}

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
          {categoryOptions(type, filters.kind).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {!batchId && (
          <select value={filters.batch} onChange={setFilter("batch")} aria-label="Batch">
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
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
      {rows?.length > 0 && (
        <div className={`ad-bulk ${picked.size ? "is-on" : ""}`}>
          <label>
            <input type="checkbox" checked={rows.length > 0 && picked.size === rows.length}
                   ref={(el) => el && (el.indeterminate = picked.size > 0 && picked.size < rows.length)}
                   onChange={pickPage} disabled={Boolean(bulk)} />
            {picked.size ? `${picked.size} selected` : "Select all on this page"}
          </label>
          {picked.size > 0 && (
            <>
              <button onClick={() => bulkStatus("hidden")} disabled={Boolean(bulk)}>Hide</button>
              <button onClick={() => bulkStatus("published")} disabled={Boolean(bulk)}>Show</button>
              <button className="ad-delete" onClick={bulkDelete} disabled={Boolean(bulk)}>Delete</button>
              <button onClick={() => setPicked(new Set())} disabled={Boolean(bulk)}>Clear</button>
            </>
          )}
          {bulk && <span>{bulk}</span>}
        </div>
      )}
      <div className="ad-list">
        {rows?.map((row) => (
          <div className={`ad-item ad-row-item ad-pickable is-${row.status} ${picked.has(row.id) ? "is-picked" : ""}`} key={row.id}>
            <input type="checkbox" className="ad-pick" checked={picked.has(row.id)} onChange={() => pick(row.id)}
                   disabled={Boolean(bulk)} aria-label={`Select ${row.code}`} />
            <div className={`ad-thumb ${type === "icon" || type === "element" ? "is-icon" : ""}`}>{row.thumb_key && <img src={publicUrl(row.thumb_key)} alt="" loading="lazy" />}</div>
            <div className="ad-fields">
              <strong>{row.title}</strong>
              <span className="ad-file">
                {row.ref_code && <b className="ad-ref">{row.ref_code}</b>}
                {row.batch?.name && <span className="ad-batch-tag">{row.batch.name}</span>}
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

function ManageAssets({ type = "vector", refreshKey }) {
  if (type === "icon") return <ManageIconSets refreshKey={refreshKey} />;
  return <ManageBatches type={type} refreshKey={refreshKey} />;
}

export default ManageAssets;
