import { useEffect, useState } from "react";
import { askConfirm } from "../../lib/confirm";
import "./Downloads.css";
import { supabase } from "../../lib/supabaseClient";
import { publicUrl } from "../../lib/r2";
import { DOWNLOAD_REFUSALS, requestDownload } from "../../lib/downloads";

// Uploaded assets: the account's history on the server (the downloads table,
// written by record_download), so it follows the account to every device.
// Trial assets: still recorded in this browser by the asset modals.
const STORAGE_KEY = "kd-downloads";

const kinds = [
  ["all", "All"],
  ["icon", "Icons"],
  ["vector", "Vectors"],
  ["logo", "Logos"],
  ["template", "Templates"],
  ["footage", "Footage"],
];

const kindLabel = Object.fromEntries(kinds);

// this browser's entries for trial assets; uploaded ones (file: null) are
// on the server and come from there instead
function loadLocal() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
    return list.filter((d) => d.file).map((d) => ({ ...d, key: `l-${d.id}-${d.date}` }));
  } catch {
    return [];
  }
}

const fromServer = (row) => ({
  key: `s-${row.id}`,
  rowId: row.id,
  assetId: row.asset_id,
  // a deleted or hidden asset can't be read any more
  gone: !row.assets,
  id: row.assets?.code ?? "",
  title: row.assets?.title ?? "No longer available",
  kind: row.assets?.type ?? "",
  image: row.assets ? publicUrl(row.assets.thumb_key) : null,
  format: row.format.toUpperCase(),
  serverFormat: row.format,
  license: row.license,
  date: row.created_at,
});

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Downloads({ setPage, user }) {
  const [local, setLocal] = useState(loadLocal);
  const [server, setServer] = useState([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(null);
  const [rowError, setRowError] = useState(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("downloads")
      .select("id, asset_id, format, license, created_at, assets(code, type, title, thumb_key)")
      // removed from the list by the member; the license record stays
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) setLoadError("Your download history couldn't be loaded. Try again later.");
        else setServer(data.map(fromServer));
        setLoading(false);
      });
  }, [user]);

  const history = [...server, ...local].sort((a, b) => (a.date < b.date ? 1 : -1));
  const items = history.filter((d) => filter === "all" || d.kind === filter);

  const downloadAgain = async (d) => {
    setRowError(null);
    if (d.assetId) {
      // the server checks the license again and hands out a fresh link
      setBusy(d.key);
      try {
        await requestDownload(d.assetId, d.serverFormat);
      } catch (e) {
        setRowError({ key: d.key, text: DOWNLOAD_REFUSALS[e.code]?.title ?? e.message });
      } finally {
        setBusy(null);
      }
      return;
    }
    const a = document.createElement("a");
    a.href = d.file || d.image;
    a.download = `${d.id}-${d.format.replace(/\W+/g, "-")}`;
    a.click();
  };

  // writes this browser's list back after something was removed from it
  const saveLocal = (next) => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
      const keys = new Set(next.map((d) => `${d.id}-${d.date}`));
      // entries of uploaded assets (file: null) are shown from the account
      const kept = stored.filter((d) => !d.file || keys.has(`${d.id}-${d.date}`));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
    } catch {
      /* storage unavailable */
    }
    setLocal(next);
  };

  // takes a row off the list; the license record stays on the server
  const removeOne = async (d) => {
    setRowError(null);
    if (!d.rowId) {
      saveLocal(local.filter((x) => x.key !== d.key));
      return;
    }
    const { error } = await supabase.rpc("hide_downloads", { p_ids: [d.rowId] });
    if (error) setRowError({ key: d.key, text: "Couldn't remove this. Try again." });
    else setServer((list) => list.filter((x) => x.key !== d.key));
  };

  const clearAll = async () => {
    const sure = await askConfirm({
      title: "Clear your download history?",
      message: "Files you already saved stay on your computer, and their licenses stay valid.",
      confirmLabel: "Clear history",
    });
    if (!sure) return;
    setLoadError(null);
    if (user) {
      const { error } = await supabase.rpc("hide_downloads");
      if (error) {
        setLoadError("Your history couldn't be cleared. Try again.");
        return;
      }
      setServer([]);
    }
    saveLocal([]);
  };

  const summary = loading
    ? "Loading your history…"
    : `${history.length} ${history.length === 1 ? "file" : "files"}${user ? "" : " downloaded on this device"}`;

  return (
    <section className="downloads-page">
      <div className="downloads-head">
        <div>
          <h1>Your downloads</h1>
          <p>{summary}</p>
        </div>
        {history.length > 0 && (
          <button className="downloads-clear" onClick={clearAll}>Clear history</button>
        )}
      </div>

      {!user && (
        <p className="downloads-note">
          <button onClick={() => setPage("login")}>Log in</button> to see everything you've downloaded with your account, on any device.
        </p>
      )}
      {loadError && <p className="downloads-note is-error">{loadError}</p>}

      {history.length > 0 && (
        <div className="downloads-tabs" role="tablist">
          {kinds.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <ul className="downloads-list">
          {items.map((d) => (
            <li key={d.key}>
              {d.image ? <img src={d.image} alt="" loading="lazy" /> : <span className="downloads-thumb" />}
              <div className="downloads-info">
                <strong>{d.title}</strong>
                <span>
                  {[kindLabel[d.kind] ?? d.kind, d.format, d.id].filter(Boolean).join(" · ")}
                </span>
                {rowError?.key === d.key && <span className="downloads-row-error">{rowError.text}</span>}
              </div>
              <span className={`downloads-license ${d.license === "free" ? "" : "is-premium"}`}>
                {d.license === "free" ? "Free" : `${d.license[0].toUpperCase()}${d.license.slice(1)} license`}
              </span>
              <time dateTime={d.date}>{formatDate(d.date)}</time>
              <button className="downloads-again" onClick={() => downloadAgain(d)} disabled={d.gone || busy === d.key}>
                {busy === d.key ? "Preparing…" : "Download again"}
              </button>
              <button className="downloads-remove" onClick={() => removeOne(d)}
                      aria-label={`Remove ${d.title} from your history`} title="Remove from history">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !loading && (
          <div className="downloads-empty">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
            </svg>
            <h2>{history.length ? "Nothing in this category" : "No downloads yet"}</h2>
            <p>Files you download from the library will show up here.</p>
            <button onClick={() => setPage("icons")}>Browse the library</button>
          </div>
        )
      )}
    </section>
  );
}

export default Downloads;
