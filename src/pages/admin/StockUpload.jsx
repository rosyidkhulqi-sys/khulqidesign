// The Photos and Mockups tabs on /admin: drop JPGs (and PSDs for mockups),
// check the details read from each JPG, publish a few at a time.
import { useEffect, useRef, useState } from "react";
import DoneNote from "./DoneNote";
import BatchField from "./BatchField";
import { openBatch } from "./batches";
import { readMetadata, shortTitle } from "./vectorUpload";
import { STOCK, groupFiles, missingFile, publishStock } from "./stockUpload";
import { runPool } from "../../lib/uploadPool";
import { MOCKUP_CATEGORY_OPTIONS, PHOTO_CATEGORY_OPTIONS } from "../../data/stockCategories";

// photos and mockups published at the same time
const AT_ONCE = 3;

function StockUpload({ kind, onPublished }) {
  const { accept, noun } = STOCK[kind];
  const categories = kind === "photo" ? PHOTO_CATEGORY_OPTIONS : MOCKUP_CATEGORY_OPTIONS;
  const [items, setItems] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [finished, setFinished] = useState(null);
  const [batch, setBatch] = useState("");
  const [batchError, setBatchError] = useState(null);
  const [dragging, setDragging] = useState(false);
  // every file dropped next is AI-made (a whole batch of AI photos)
  const [allAi, setAllAi] = useState(false);
  const input = useRef(null);
  const urls = useRef([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const update = (base, patch) => setItems((list) => list.map((it) => (it.base === base ? { ...it, ...patch } : it)));

  const addFiles = async (dropped) => {
    const fresh = groupFiles(kind, dropped)
      .filter((g) => !items.some((it) => it.base === g.base))
      .map((g) => {
        const thumb = g.jpg ? URL.createObjectURL(g.jpg) : null;
        if (thumb) urls.current.push(thumb);
        const lacks = missingFile(kind, g);
        return {
          ...g, thumb, title: "", longTitle: "", description: "", keywords: [], aiGenerated: allAi,
          category: "other", license: "premium", progress: 0,
          status: lacks ? "incomplete" : "reading",
          message: lacks ? `Missing ${lacks}` : "Reading metadata",
        };
      });
    setItems((list) => [...list, ...fresh]);
    for (const item of fresh.filter((it) => it.status === "reading")) {
      try {
        const meta = await readMetadata(item.jpg);
        update(item.base, {
          ...meta,
          // the file's own AI mark, or the batch switch
          aiGenerated: meta.aiGenerated || allAi,
          title: shortTitle(meta.longTitle) || shortTitle(item.base.replace(/[-_]+/g, " ")),
          status: "ready",
          message: meta.keywords.length ? `${meta.keywords.length} keywords` : "No keywords in this file",
        });
      } catch {
        update(item.base, { title: shortTitle(item.base), status: "ready", message: "Couldn't read metadata" });
      }
    }
  };

  const ready = items.filter((it) => it.status === "ready" || it.status === "error").length;

  const publishAll = async () => {
    setPublishing(true);
    setFinished(null);
    let published = 0;
    let batchId;
    try {
      batchId = await openBatch(kind, batch);
    } catch (e) {
      setBatchError(e.message);
      setPublishing(false);
      return;
    }
    setBatchError(null);
    const queue = items.filter((it) => it.status === "ready" || it.status === "error");
    await runPool(queue, AT_ONCE, async (item) => {
      if (!item.title.trim()) {
        update(item.base, { status: "error", message: "Add a title first" });
        return;
      }
      update(item.base, { status: "uploading", progress: 0, message: "Preparing" });
      try {
        const code = await publishStock(kind, { ...item, batchId, title: item.title.trim() }, (message, progress) =>
          update(item.base, { message, progress }));
        update(item.base, { status: "done", progress: 1, message: `Published as ${code}` });
        published += 1;
      } catch (e) {
        update(item.base, { status: "error", message: e.message });
      }
    });
    setItems((list) => list.filter((it) => it.status !== "done"));
    if (published) setFinished({ published, failed: queue.length - published, where: batch.trim() || null });
    setPublishing(false);
    onPublished?.();
  };

  return (
    <>
      <DoneNote finished={finished} noun={noun} onClose={() => setFinished(null)} />
      <BatchField type={kind} value={batch} onChange={setBatch} disabled={publishing} />
      <label className="ad-ai-switch">
        <input type="checkbox" checked={allAi} disabled={publishing}
               onChange={(e) => {
                 setAllAi(e.target.checked);
                 setItems((list) => list.map((it) => (it.status === "done" ? it : { ...it, aiGenerated: e.target.checked })));
               }} />
        <span><strong>AI-generated</strong> · every file in this upload gets the AI label (files whose metadata says AI get it anyway)</span>
      </label>
      {batchError && <p className="ad-error">{batchError}</p>}
      <div
        className={`ad-drop ${dragging ? "is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles([...e.dataTransfer.files]); }}
      >
        <strong>{kind === "photo" ? "Drop JPG or PNG photos here" : "Drop PSD and JPG files here"}</strong>
        <span>
          {kind === "photo"
            ? "Each JPG or PNG becomes one photo, sold full size; a transparent PNG stays transparent. Title, description and keywords come from the file's metadata, as on Adobe Stock."
            : "A PSD and a JPG with the same name become one mockup: the PSD is sold, the JPG shows it. Details come from the JPG's metadata."}
        </span>
        <button onClick={() => input.current?.click()}>Choose files</button>
        <input ref={input} type="file" multiple accept={accept} hidden
               onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
      </div>

      {items.length > 0 && (
        <>
          <div className="ad-bar">
            <span>{items.length} {items.length === 1 ? noun[0] : noun[1]}</span>
            <button className="ad-primary" onClick={publishAll} disabled={publishing || ready === 0}>
              {publishing ? "Publishing…" : `Publish ${ready}`}
            </button>
          </div>
          <div className="ad-list">
            {items.map((it) => {
              const locked = publishing || it.status === "done" || it.status === "uploading" || it.status === "incomplete";
              return (
                <div className={`ad-item is-${it.status}`} key={it.base}>
                  <div className="ad-thumb">{it.thumb && <img src={it.thumb} alt="" />}</div>
                  <div className="ad-fields">
                    <input value={it.title} placeholder="Short title" maxLength={80} disabled={locked}
                           onChange={(e) => update(it.base, { title: e.target.value })} aria-label="Title" />
                    <div className="ad-row">
                      <select value={it.category} disabled={locked} aria-label="Category"
                              onChange={(e) => update(it.base, { category: e.target.value })}>
                        {categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                      </select>
                      <select value={it.license} disabled={locked} aria-label="License"
                              onChange={(e) => update(it.base, { license: e.target.value })}>
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                      </select>
                      <label className={`ad-ai-chip ${it.aiGenerated ? "on" : ""}`} title="Made with generative AI">
                        <input type="checkbox" checked={Boolean(it.aiGenerated)} disabled={locked}
                               onChange={(e) => update(it.base, { aiGenerated: e.target.checked })} />
                        AI
                      </label>
                      <span className="ad-file">{it.base}</span>
                    </div>
                    {it.keywords.length > 0 && (
                      <p className="ad-keywords">{it.keywords.slice(0, 12).join(", ")}{it.keywords.length > 12 ? " …" : ""}</p>
                    )}
                  </div>
                  <div className="ad-status">
                    <span>{it.message}</span>
                    {it.status === "uploading" && (
                      <div className="ad-progress"><span style={{ width: `${Math.round(it.progress * 100)}%` }} /></div>
                    )}
                    {!publishing && it.status !== "uploading" && (
                      <button className="ad-remove" onClick={() => setItems((list) => list.filter((x) => x.base !== it.base))}
                              aria-label={`Remove ${it.base}`}>Remove</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

export default StockUpload;
