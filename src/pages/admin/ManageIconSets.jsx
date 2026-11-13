// Icon sets are managed as groups so an owner can find, hide, or remove a
// whole upload without paging through hundreds of individual icons.
import { useEffect, useState } from "react";
import { askConfirm } from "../../lib/confirm";
import { supabase } from "../../lib/supabaseClient";
import { deleteFromR2, publicUrl } from "../../lib/r2";
import { ICON_CATEGORIES, ICON_STYLES, splitKeywords } from "./iconPublish";
import EditAsset from "./EditAsset";

const PAGE_SIZE = 25;
const MEMBER_PAGE_SIZE = 500;
const SET_FIELDS = "id, code, name, style, category, license, status, description, keywords, created_at, icon_count:assets(count)";
const ICON_FIELDS = "id, code, ref_code, source_name, title, description, keywords, category, industry, style, license, price_cents, sold_at, status, thumb_key, preview_key, preview_video_key, files, created_at";
const blankFilters = { search: "", category: "", month: "", license: "", status: "", sort: "newest" };
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

function monthOptions() {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return [
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      date.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
    ];
  });
}

function iconCount(set) {
  const embedded = set.icon_count;
  const count = Array.isArray(embedded) ? embedded[0]?.count : embedded?.count;
  return Number(count ?? 0);
}

function objectKeys(icons) {
  const pairs = icons.flatMap((icon) => [
    ...(icon.files ?? []).map((file) => [file.bucket ?? "private", file.key]),
    ["public", icon.thumb_key],
    ["public", icon.preview_key],
    ["public", icon.preview_video_key],
  ]).filter(([, key]) => key);
  return [...new Map(pairs.map((pair) => [pair.join("/"), pair])).values()];
}

async function loadAllIcons(setId) {
  const icons = [];
  for (let from = 0; ; from += MEMBER_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("assets")
      .select(ICON_FIELDS)
      .eq("type", "icon")
      .eq("set_id", setId)
      .order("title")
      .range(from, from + MEMBER_PAGE_SIZE - 1);
    if (error) throw error;
    icons.push(...(data ?? []));
    if (!data || data.length < MEMBER_PAGE_SIZE) break;
  }
  return icons;
}

async function loadSetSamples(sets) {
  const ids = sets.map((set) => set.id);
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("assets")
    .select("set_id, title, thumb_key, created_at")
    .eq("type", "icon")
    .in("set_id", ids)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw error;

  const samples = {};
  for (const icon of data ?? []) {
    if (!samples[icon.set_id]) samples[icon.set_id] = icon;
  }
  const missing = sets.filter((set) => !samples[set.id]);
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5);
    const results = await Promise.all(batch.map((set) =>
      supabase.from("assets")
        .select("set_id, title, thumb_key, created_at")
        .eq("type", "icon")
        .eq("set_id", set.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
    ));
    results.forEach(({ data: icon, error: sampleError }, index) => {
      if (sampleError) throw sampleError;
      if (icon) samples[batch[index].id] = icon;
    });
  }
  return samples;
}

async function deleteObjects(icons) {
  const objects = objectKeys(icons);
  const failures = [];
  for (let i = 0; i < objects.length; i += 8) {
    const batch = objects.slice(i, i + 8);
    const results = await Promise.allSettled(batch.map(([bucket, key]) => deleteFromR2(bucket, key)));
    results.forEach((result, index) => {
      if (result.status === "rejected") failures.push(batch[index][1]);
    });
  }
  return failures;
}

function ManageIconSets({ refreshKey }) {
  const [sets, setSets] = useState(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(blankFilters);
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [members, setMembers] = useState({});
  const [editing, setEditing] = useState(null);
  const [editingSet, setEditingSet] = useState(null);
  const [setDraft, setSetDraft] = useState(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      let query = supabase
        .from("asset_sets")
        .select(SET_FIELDS, { count: "exact" })
        .eq("type", "icon");

      filters.search
        .split(/\s+/)
        .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, ""))
        .filter(Boolean)
        .forEach((word) => {
          query = query.or(
            `name.ilike.%${word}%,code.ilike.%${word}%,keywords.cs.{${word.toLowerCase()}}`
          );
        });
      if (filters.category) query = query.eq("category", filters.category);
      if (filters.license) query = query.eq("license", filters.license);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.month) {
        const [year, month] = filters.month.split("-").map(Number);
        query = query
          .gte("created_at", new Date(year, month - 1, 1).toISOString())
          .lt("created_at", new Date(year, month, 1).toISOString());
      }
      query = filters.sort === "title"
        ? query.order("name", { ascending: true })
        : query.order("created_at", { ascending: filters.sort === "oldest" });

      const { data, count, error: queryError } = await query.range(
        page * PAGE_SIZE,
        page * PAGE_SIZE + PAGE_SIZE - 1,
      );
      if (!alive) return;
      if (queryError) {
        setError(queryError.message);
        return;
      }
      let samples;
      try {
        samples = await loadSetSamples(data ?? []);
      } catch (sampleError) {
        if (!alive) return;
        setError(sampleError.message);
        return;
      }
      if (!alive) return;
      setError(null);
      setSets((data ?? []).map((set) => ({ ...set, iconCount: iconCount(set), sample: samples[set.id] ?? null })));
      setTotal(count ?? 0);
      setExpanded(null);
      setMembers({});
    }, filters.search ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters, page, refreshKey, reload]);

  const setFilter = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(blankFilters);
    setPage(0);
  };

  const editSet = (set) => {
    setEditingSet(set.id);
    setEditing(null);
    setSetDraft({
      name: set.name ?? "",
      style: set.style ?? ICON_STYLES[0],
      description: set.description ?? "",
      category: set.category ?? ICON_CATEGORIES[0],
      license: set.license ?? "free",
      keywords: (set.keywords ?? []).join(", "),
    });
  };

  const saveSet = async (set) => {
    const name = setDraft?.name.trim();
    if (!name) {
      setError("A set title is required.");
      return;
    }
    setBusy(set.id);
    setError(null);

    const keywords = splitKeywords(setDraft.keywords);
    const changes = {
      name,
      style: setDraft.style,
      description: setDraft.description.trim() || null,
      category: setDraft.category,
      license: setDraft.license,
      keywords,
    };

    // Keep the individual icons in sync with shared set metadata. Preserve
    // each icon's own terms while replacing the old shared set keywords/style.
    const previousIcons = [];
    for (let from = 0; ; from += MEMBER_PAGE_SIZE) {
      const { data, error: iconReadError } = await supabase
        .from("assets")
        .select("id, keywords, style, category, license")
        .eq("type", "icon")
        .eq("set_id", set.id)
        .range(from, from + MEMBER_PAGE_SIZE - 1);
      if (iconReadError) {
        setBusy(null);
        setError(iconReadError.message);
        return;
      }
      previousIcons.push(...(data ?? []));
      if (!data || data.length < MEMBER_PAGE_SIZE) break;
    }

    const oldSharedTerms = new Set([...(set.keywords ?? []), set.style, "icon"].filter(Boolean));
    const nextSharedTerms = [...keywords, changes.style, "icon"];
    const iconChanges = previousIcons.map((icon) => ({
      id: icon.id,
      keywords: [...new Set([
        ...(icon.keywords ?? []).filter((word) => !oldSharedTerms.has(word)),
        ...nextSharedTerms,
      ])],
      style: changes.style,
      category: changes.category,
      license: changes.license,
    }));

    const updateIconChanges = async (rows, rollback = false) => {
      const results = [];
      for (let from = 0; from < rows.length; from += 20) {
        const batch = rows.slice(from, from + 20);
        const batchResults = await Promise.all(batch.map((row) => {
          const previous = previousIcons.find((icon) => icon.id === row.id);
          const values = rollback && previous
            ? { keywords: previous.keywords ?? [], style: previous.style, category: previous.category, license: previous.license }
            : { keywords: row.keywords, style: row.style, category: row.category, license: row.license };
          return supabase.from("assets").update(values).eq("id", row.id).then(({ error }) => ({ id: row.id, error }));
        }));
        results.push(...batchResults);
        if (batchResults.some((result) => result.error)) break;
      }
      return results;
    };

    const iconUpdateResults = await updateIconChanges(iconChanges);
    const iconUpdateError = iconUpdateResults.find((result) => result.error)?.error;
    if (iconUpdateError) {
      const changedIds = new Set(iconUpdateResults.filter((result) => !result.error).map((result) => result.id));
      await updateIconChanges(previousIcons.filter((icon) => changedIds.has(icon.id)), true);
      setBusy(null);
      setError(iconUpdateError.message);
      return;
    }

    const { error: updateError } = await supabase.from("asset_sets").update(changes).eq("id", set.id);
    if (updateError) {
      await updateIconChanges(previousIcons, true);
      setBusy(null);
      setError(updateError.message);
      return;
    }

    setSets((list) => list.map((item) => item.id === set.id ? { ...item, ...changes } : item));
    setMembers((current) => ({
      ...current,
      ...(current[set.id] ? { [set.id]: current[set.id].map((icon) => ({
        ...icon,
        style: changes.style,
        category: changes.category,
        license: changes.license,
        keywords: iconChanges.find((updated) => updated.id === icon.id)?.keywords ?? icon.keywords,
      })) } : {}),
    }));
    setEditingSet(null);
    setSetDraft(null);
    setBusy(null);
    setReload((value) => value + 1);
  };

  const expandSet = async (set) => {
    if (expanded === set.id) {
      setExpanded(null);
      setEditing(null);
      return;
    }
    setExpanded(set.id);
    setEditing(null);
    if (members[set.id]) return;
    setBusy(set.id);
    try {
      const icons = await loadAllIcons(set.id);
      setMembers((current) => ({ ...current, [set.id]: icons }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleSet = async (set) => {
    const nextStatus = set.status === "published" ? "hidden" : "published";
    setBusy(set.id);
    setError(null);
    const { error: iconError } = await supabase
      .from("assets")
      .update({ status: nextStatus })
      .eq("type", "icon")
      .eq("set_id", set.id);
    if (iconError) {
      setBusy(null);
      setError(iconError.message);
      return;
    }
    const { error: setError } = await supabase
      .from("asset_sets")
      .update({ status: nextStatus })
      .eq("id", set.id);
    if (setError) {
      await supabase.from("assets").update({ status: set.status }).eq("type", "icon").eq("set_id", set.id);
      setBusy(null);
      setError(setError.message);
      return;
    }
    setSets((list) => list.map((item) => item.id === set.id ? { ...item, status: nextStatus } : item));
    setMembers((current) => ({
      ...current,
      ...(current[set.id] ? { [set.id]: current[set.id].map((icon) => ({ ...icon, status: nextStatus })) } : {}),
    }));
    setBusy(null);
  };

  const removeSet = async (set) => {
    const count = set.iconCount;
    const sure = await askConfirm({
      title: `Delete the “${set.name}” icon set?`,
      message: `All ${count} icon${count === 1 ? "" : "s"} in it and their files are removed from storage. This can't be undone.`,
      confirmLabel: "Delete set",
      typeToConfirm: set.name,
    });
    if (!sure) return;
    setBusy(set.id);
    setError(null);
    try {
      const icons = await loadAllIcons(set.id);
      // The foreign key from downloads to assets restricts deletion. Let the
      // database reject the whole set atomically if any icon was downloaded.
      const { error: iconDeleteError } = await supabase
        .from("assets")
        .delete()
        .eq("type", "icon")
        .eq("set_id", set.id);
      if (iconDeleteError) {
        setError(iconDeleteError.code === "23503"
          ? "This set has downloaded icons, so hide the set instead of deleting it."
          : iconDeleteError.message);
        setBusy(null);
        return;
      }
      const { error: setDeleteError } = await supabase.from("asset_sets").delete().eq("id", set.id);
      const fileFailures = await deleteObjects(icons);
      if (setDeleteError) setError(setDeleteError.message);
      else if (fileFailures.length) setError(`${set.name} was removed from the catalog, but ${fileFailures.length} R2 file${fileFailures.length === 1 ? "" : "s"} could not be deleted.`);
      setExpanded(null);
      setEditing(null);
      setEditingSet(null);
      setSetDraft(null);
      setReload((value) => value + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleIcon = async (icon) => {
    setBusy(icon.id);
    const status = icon.status === "published" ? "hidden" : "published";
    const { error: updateError } = await supabase.from("assets").update({ status }).eq("id", icon.id);
    if (updateError) setError(updateError.message);
    else setMembers((current) => ({
      ...current,
      [expanded]: current[expanded].map((item) => item.id === icon.id ? { ...item, status } : item),
    }));
    setBusy(null);
  };

  const removeIcon = async (icon, set) => {
    const sure = await askConfirm({
      title: `Delete ${icon.code}?`,
      message: `“${icon.title}” and its files are removed from storage. This can't be undone.`,
    });
    if (!sure) return;
    setBusy(icon.id);
    setError(null);
    const { error: deleteError } = await supabase.from("assets").delete().eq("id", icon.id);
    if (deleteError) {
      setError(deleteError.code === "23503"
        ? `${icon.code} has download history, so hide it instead of deleting.`
        : deleteError.message);
      setBusy(null);
      return;
    }
    const fileFailures = await deleteObjects([icon]);
    if (fileFailures.length) setError(`${icon.code} was removed from the catalog, but its R2 file could not be deleted.`);
    setMembers((current) => ({ ...current, [set.id]: current[set.id].filter((item) => item.id !== icon.id) }));
    setSets((list) => list.map((item) => item.id === set.id ? { ...item, iconCount: Math.max(0, item.iconCount - 1) } : item));
    setBusy(null);
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Object.keys(blankFilters).some((key) => key !== "sort" && filters[key]);

  if (sets === null && !error) return <p className="ad-note">Loading uploaded icon sets…</p>;

  return (
    <div className="ad-manage">
      <h2>Uploaded icon sets <span>{total}</span></h2>
      <p className="ad-note">Each set stays together with its icons. Expand a set for individual controls, or manage the whole set at once.</p>

      <div className="ad-filters">
        <input
          type="search"
          className="ad-find"
          placeholder="Search set name, set code, or set keywords"
          aria-label="Search icon sets"
          value={filters.search}
          onChange={setFilter("search")}
        />
        <select value={filters.category} onChange={setFilter("category")} aria-label="Category">
          <option value="">All categories</option>
          {ICON_CATEGORIES.map((category) => <option key={category} value={category}>{capitalize(category)}</option>)}
        </select>
        <select value={filters.month} onChange={setFilter("month")} aria-label="Upload month">
          <option value="">Any month</option>
          {monthOptions().map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.license} onChange={setFilter("license")} aria-label="License">
          <option value="">Any license</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
        <select value={filters.status} onChange={setFilter("status")} aria-label="Status">
          <option value="">Any status</option>
          <option value="published">On the site</option>
          <option value="hidden">Hidden</option>
        </select>
        <select value={filters.sort} onChange={setFilter("sort")} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Name A–Z</option>
        </select>
        {filtered && <button className="ad-clear" onClick={clearFilters}>Clear</button>}
      </div>

      {error && <p className="ad-error" role="alert">{error}</p>}
      {sets?.length === 0 && <p className="ad-note">{filtered ? "Nothing matches these filters." : "No icon sets uploaded yet."}</p>}

      <div className="ad-list ad-icon-set-list">
        {sets?.map((set) => (
          <section className={`ad-item ad-row-item ad-icon-set is-${set.status}`} key={set.id}>
            <div className="ad-thumb is-icon">
              {set.sample?.thumb_key
                ? <img src={publicUrl(set.sample.thumb_key)} alt={set.sample.title ? `${set.sample.title} icon` : ""} loading="lazy" />
                : <span aria-hidden="true">◇</span>}
            </div>
            <div className="ad-fields">
              <strong>{set.name}</strong>
              <span className="ad-file">
                {set.code} · {set.iconCount} {set.iconCount === 1 ? "icon" : "icons"} · {capitalize(set.style ?? "outline")} · {capitalize(set.category ?? "other")} · {capitalize(set.license)} · {new Date(set.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {set.description && <span className="ad-file">{set.description}</span>}
            </div>
            <div className="ad-actions">
              <span className={`ad-pill is-${set.status}`}>{set.status === "published" ? "On the site" : "Hidden"}</span>
              <button onClick={() => expandSet(set)} disabled={busy === set.id}>
                {busy === set.id && expanded === set.id ? "Loading…" : expanded === set.id ? "Collapse" : "View icons"}
              </button>
              <button onClick={() => editingSet === set.id ? (setEditingSet(null), setSetDraft(null)) : editSet(set)} disabled={busy === set.id}>
                {editingSet === set.id ? "Cancel edit" : "Edit set"}
              </button>
              <button onClick={() => toggleSet(set)} disabled={busy === set.id}>
                {set.status === "published" ? "Hide set" : "Show set"}
              </button>
              <button className="ad-delete" onClick={() => removeSet(set)} disabled={busy === set.id}>
                Delete set
              </button>
            </div>

            {editingSet === set.id && setDraft && (
              <div className="ad-icon-set-edit">
                <input
                  placeholder="Set name, e.g. Shopping & Promo"
                  value={setDraft.name}
                  maxLength={60}
                  onChange={(event) => setSetDraft((draft) => ({ ...draft, name: event.target.value }))}
                  aria-label="Set name"
                />
                <div className="ad-row">
                  <select value={setDraft.style} onChange={(event) => setSetDraft((draft) => ({ ...draft, style: event.target.value }))} aria-label="Style">
                    {ICON_STYLES.map((style) => <option key={style} value={style}>{capitalize(style)}</option>)}
                  </select>
                  <select value={setDraft.category} onChange={(event) => setSetDraft((draft) => ({ ...draft, category: event.target.value }))} aria-label="Category">
                    {ICON_CATEGORIES.map((category) => <option key={category} value={category}>{capitalize(category)}</option>)}
                  </select>
                  <select value={setDraft.license} onChange={(event) => setSetDraft((draft) => ({ ...draft, license: event.target.value }))} aria-label="Default license">
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <input
                  placeholder="Short description (optional)"
                  value={setDraft.description}
                  maxLength={140}
                  onChange={(event) => setSetDraft((draft) => ({ ...draft, description: event.target.value }))}
                  aria-label="Description"
                />
                <input
                  placeholder="Keywords for every icon in the set, comma separated"
                  value={setDraft.keywords}
                  onChange={(event) => setSetDraft((draft) => ({ ...draft, keywords: event.target.value }))}
                  aria-label="Set keywords"
                />
                <div className="ad-icon-set-edit-actions">
                  <button onClick={() => { setEditingSet(null); setSetDraft(null); }} disabled={busy === set.id}>Cancel</button>
                  <button className="ad-primary" onClick={() => saveSet(set)} disabled={busy === set.id}>
                    {busy === set.id ? "Saving…" : "Save set"}
                  </button>
                </div>
              </div>
            )}

            {expanded === set.id && (
              <div className="ad-icon-set-members">
                {!members[set.id] ? (
                  <p className="ad-note">Loading icons…</p>
                ) : members[set.id].length === 0 ? (
                  <p className="ad-note">This set has no icons.</p>
                ) : members[set.id].map((icon) => (
                  <div className={`ad-icon-set-member ${icon.status === "hidden" ? "is-hidden" : ""}`} key={icon.id}>
                    <div className="ad-thumb is-icon">{icon.thumb_key && <img src={publicUrl(icon.thumb_key)} alt="" loading="lazy" />}</div>
                    <div className="ad-fields">
                      <strong>{icon.title}</strong>
                      <span className="ad-file">{icon.code} · {capitalize(icon.license)} · {icon.status === "published" ? "On the site" : "Hidden"}</span>
                    </div>
                    <div className="ad-actions">
                      <button onClick={() => setEditing(editing === icon.id ? null : icon.id)} disabled={busy === icon.id}>Edit</button>
                      <button onClick={() => toggleIcon(icon)} disabled={busy === icon.id}>{icon.status === "published" ? "Hide" : "Show"}</button>
                      <button className="ad-delete" onClick={() => removeIcon(icon, set)} disabled={busy === icon.id}>Delete</button>
                    </div>
                    {editing === icon.id && (
                      <EditAsset
                        row={icon}
                        type="icon"
                        onCancel={() => setEditing(null)}
                        onSaved={(changes) => {
                          setMembers((current) => ({
                            ...current,
                            [set.id]: current[set.id].map((item) => item.id === icon.id ? { ...item, ...changes } : item),
                          }));
                          setEditing(null);
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {pages > 1 && (
        <div className="ad-pager">
          <button onClick={() => setPage((value) => value - 1)} disabled={page === 0}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button onClick={() => setPage((value) => value + 1)} disabled={page + 1 >= pages}>Next</button>
        </div>
      )}
    </div>
  );
}

export default ManageIconSets;
