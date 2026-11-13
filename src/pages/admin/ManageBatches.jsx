// Uploaded assets on /admin, one row per upload batch (like icon sets), so
// thousands of files stay a short list. Open a batch to see and manage its
// files, or hide, show, rename or delete the whole batch at once. "All
// files" is the flat list, for searching across batches.
import { useEffect, useState } from "react";
import { askConfirm } from "../../lib/confirm";
import { publicUrl } from "../../lib/r2";
import { ManageAssetRows } from "./ManageAssets";
import { batchOverview, deleteBatch, renameBatch, setBatchStatus } from "./batches";

const LABEL = { vector: "vectors", logo: "logos", footage: "clips", template: "templates", element: "elements" };
const ONE = { vector: "vector", logo: "logo", footage: "clip", template: "template", element: "element" };

const dateOf = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function ManageBatches({ type, refreshKey }) {
  const [view, setView] = useState("batches");
  const [batches, setBatches] = useState(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    batchOverview(type)
      .then((list) => alive && (setBatches(list), setError(null)))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [type, refreshKey, reload]);

  const run = async (batch, job) => {
    setBusy(batch.id);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
    setProgress(null);
    setReload((n) => n + 1);
  };

  const remove = async (batch) => {
    const sure = await askConfirm({
      title: `Delete the batch “${batch.name}”?`,
      message: `All ${batch.total} ${Number(batch.total) === 1 ? ONE[type] : LABEL[type]} in it and their files are removed from storage. This can't be undone.`,
      confirmLabel: "Delete batch",
      typeToConfirm: batch.name,
    });
    if (!sure) return;
    run(batch, async () => {
      const { kept } = await deleteBatch(batch.id, type, (done, total) => setProgress({ id: batch.id, done, total }));
      if (kept) setError(`${kept} ${kept === 1 ? ONE[type] : LABEL[type]} had been downloaded, so they were hidden instead of deleted.`);
      if (open === batch.id) setOpen(null);
    });
  };

  const q = search.trim().toLowerCase();
  const shown = (batches ?? []).filter((b) => !q || b.name.toLowerCase().includes(q));
  const totalAssets = (batches ?? []).reduce((n, b) => n + Number(b.total), 0);

  return (
    <div className="ad-manage">
      <h2>
        Uploaded {LABEL[type]} <span>{totalAssets} in {batches?.length ?? 0} {batches?.length === 1 ? "batch" : "batches"}</span>
      </h2>
      <div className="ad-view-switch" role="tablist" aria-label="View">
        <button role="tab" aria-selected={view === "batches"} className={view === "batches" ? "active" : ""} onClick={() => setView("batches")}>
          Batches
        </button>
        <button role="tab" aria-selected={view === "files"} className={view === "files" ? "active" : ""} onClick={() => setView("files")}>
          All files
        </button>
      </div>

      {view === "files" ? (
        <ManageAssetRows type={type} refreshKey={refreshKey} />
      ) : (
        <>
          <div className="ad-filters">
            <input type="search" className="ad-find" placeholder="Search batch name, such as M 1026"
                   aria-label="Search batches" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {error && <p className="ad-error" role="alert">{error}</p>}
          {batches === null && !error && <p className="ad-note">Loading batches…</p>}
          {batches?.length === 0 && <p className="ad-note">No {LABEL[type]} uploaded yet.</p>}
          {batches?.length > 0 && shown.length === 0 && <p className="ad-note">No batch matches “{search}”.</p>}

          <div className="ad-list">
            {shown.map((b) => {
              const working = busy === b.id;
              const allHidden = Number(b.published) === 0 && Number(b.total) > 0;
              return (
                <section className={`ad-item ad-row-item ad-batch-row ${allHidden ? "is-hidden" : ""}`} key={b.id}>
                  <div className={`ad-thumb ${type === "element" ? "is-icon" : ""}`}>
                    {b.thumb_key && <img src={publicUrl(b.thumb_key)} alt="" loading="lazy" />}
                  </div>
                  <div className="ad-fields">
                    {renaming === b.id ? (
                      <form className="ad-batch-rename" onSubmit={(e) => {
                        e.preventDefault();
                        if (!draft.trim()) return;
                        run(b, async () => {
                          await renameBatch(b.id, draft);
                          setRenaming(null);
                        });
                      }}>
                        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} autoFocus aria-label="Batch name" />
                        <button type="submit" disabled={working}>Save</button>
                        <button type="button" onClick={() => setRenaming(null)}>Cancel</button>
                      </form>
                    ) : (
                      <strong>{b.name}</strong>
                    )}
                    <span className="ad-file">
                      {b.total} {Number(b.total) === 1 ? ONE[type] : LABEL[type]} · {b.published} on the site
                      {Number(b.hidden) > 0 && ` · ${b.hidden} hidden`} · {dateOf(b.created_at)}
                    </span>
                    {progress?.id === b.id && (
                      <span className="ad-file">Deleting {progress.done} of {progress.total}…</span>
                    )}
                  </div>
                  <div className="ad-actions">
                    <button onClick={() => setOpen(open === b.id ? null : b.id)} disabled={working || Number(b.total) === 0}>
                      {open === b.id ? "Close" : "Open"}
                    </button>
                    <button onClick={() => { setRenaming(b.id); setDraft(b.name); }} disabled={working}>Rename</button>
                    {allHidden ? (
                      <button onClick={() => run(b, () => setBatchStatus(b.id, "published"))} disabled={working}>Show all</button>
                    ) : (
                      <button onClick={() => run(b, () => setBatchStatus(b.id, "hidden"))} disabled={working || Number(b.total) === 0}>Hide all</button>
                    )}
                    <button className="ad-delete" onClick={() => remove(b)} disabled={working}>Delete</button>
                  </div>
                  {open === b.id && (
                    <div className="ad-batch-open">
                      <ManageAssetRows type={type} refreshKey={`${refreshKey}-${reload}`} batchId={b.id} />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default ManageBatches;
