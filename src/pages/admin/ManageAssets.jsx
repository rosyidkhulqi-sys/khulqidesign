// Uploaded assets on /admin: edit one's details, hide or show it, or delete it.
// Admins see every row (RLS); visitors only ever see published ones.
// Deleting removes the row first, then its files from both R2 buckets.
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { deleteFromR2, publicUrl } from "../../lib/r2";
import EditAsset from "./EditAsset";

const LABEL = { vector: "vectors", icon: "icons", logo: "logos", footage: "clips", template: "templates", element: "elements" };

function ManageAssets({ type = "vector", refreshKey }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);
  // the id of the asset being edited
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  // reloads on mount and after each publish (refreshKey changes)
  useEffect(() => {
    let alive = true;
    supabase
      .from("assets")
      .select("id, code, title, description, keywords, category, industry, style, license, price_cents, sold_at, status, thumb_key, preview_key, preview_video_key, files, created_at")
      .eq("type", type)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e.message);
        else setRows(data);
      });
    return () => {
      alive = false;
    };
  }, [type, refreshKey]);

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
    setRows((list) => list.filter((r) => r.id !== row.id));
  };

  if (rows === null && !error) return <p className="ad-note">Loading uploaded {LABEL[type]}…</p>;

  return (
    <div className="ad-manage">
      <h2>Uploaded {LABEL[type]} <span>{rows?.length ?? 0}</span></h2>
      {error && <p className="ad-error">{error}</p>}
      {rows?.length === 0 && <p className="ad-note">No {LABEL[type]} uploaded yet.</p>}
      <div className="ad-list">
        {rows?.map((row) => (
          <div className={`ad-item ad-row-item is-${row.status}`} key={row.id}>
            <div className={`ad-thumb ${type === "icon" || type === "element" ? "is-icon" : ""}`}>{row.thumb_key && <img src={publicUrl(row.thumb_key)} alt="" loading="lazy" />}</div>
            <div className="ad-fields">
              <strong>{row.title}</strong>
              <span className="ad-file">
                {row.code} · {row.license.charAt(0).toUpperCase() + row.license.slice(1)} ·{" "}
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
    </div>
  );
}

export default ManageAssets;
