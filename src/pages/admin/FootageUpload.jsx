// The Footage tab on /admin: drop MP4/MOV files, check what was read from
// each clip, publish. Previews are recorded in real time, one clip after
// another, so a 15 s clip takes about 15 s; keep this tab in front.
import { useEffect, useRef, useState } from "react";
import DoneNote from "./DoneNote";
import BatchField from "./BatchField";
import { openBatch } from "./batches";
import UploadProgress from "./UploadProgress";
import useUploadRun from "./useUploadRun";

// clips published at the same time (video files are big)
const CLIPS_AT_ONCE = 2;
import {
  FOOTAGE_CATEGORIES,
  findPlayable,
  measureFps,
  pairFootage,
  publishClip,
  readFootageMeta,
  shortTitle,
} from "./footagePublish";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const mb = (bytes) => `${(bytes / 1_000_000).toFixed(bytes > 100_000_000 ? 0 : 1)} MB`;
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function FootageUpload({ onPublished }) {
  const [items, setItems] = useState([]);
  const [publishing, setPublishing] = useState(false);
  // the last publish: how many went up, how many failed
  const [finished, setFinished] = useState(null);
  const [batch, setBatch] = useState("");
  const [batchError, setBatchError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const urls = useRef([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const update = (base, patch) => setItems((list) => list.map((it) => (it.base === base ? { ...it, ...patch } : it)));

  const addFiles = async (fileList) => {
    const groups = pairFootage([...fileList]).filter((g) => !items.some((it) => it.base === g.base));
    const fresh = groups.map((g) => ({
      ...g,
      title: shortTitle(g.base),
      longTitle: "",
      description: "",
      keywords: [],
      category: "abstract",
      license: "premium",
      status: "reading",
      message: "Reading clip",
      progress: 0,
    }));
    setItems((list) => [...list, ...fresh]);

    for (const item of fresh) {
      const playable = await findPlayable(item.files);
      if (!playable) {
        update(item.base, {
          status: "error",
          message: "This browser can't play this file. Try the MP4 version, or open /admin in Safari.",
        });
        continue;
      }
      const preview = URL.createObjectURL(playable.file);
      urls.current.push(preview);
      const [meta, fps] = await Promise.all([
        readFootageMeta(item.files.find((f) => /\.mp4$/i.test(f.name)) ?? item.files[0]).catch(() => null),
        measureFps(playable.file).catch(() => null),
      ]);
      update(item.base, {
        playable,
        preview,
        fps,
        ...(meta ?? {}),
        title: shortTitle(meta?.longTitle || "") || item.title,
        status: "ready",
        message: meta?.keywords?.length ? `${meta.keywords.length} keywords` : "No keywords in this file",
      });
    }
  };

  const [run, pool] = useUploadRun();

  const publishAll = async () => {
    setPublishing(true);
    setFinished(null);
    let published = 0;
    let batchId;
    try {
      batchId = await openBatch("footage", batch);
    } catch (e) {
      setBatchError(e.message);
      setPublishing(false);
      return;
    }
    setBatchError(null);
    const queue = items.filter((it) => it.status === "ready" || it.status === "failed");
    await pool(queue, CLIPS_AT_ONCE, async (item) => {
      if (!item.title.trim()) {
        update(item.base, { status: "failed", message: "Add a title first" });
        return;
      }
      update(item.base, { status: "uploading", progress: 0, message: "Preparing" });
      try {
        const code = await publishClip({ ...item, batchId, title: item.title.trim() }, (message, progress) =>
          update(item.base, { message, progress })
        );
        update(item.base, { status: "done", progress: 1, message: `Published as ${code}` });
        published += 1;
      } catch (e) {
        update(item.base, { status: "failed", message: e.message });
      }
    });
    // the published cards go, a Done note stays (as on The Noun Project)
    setItems((list) => list.filter((it) => it.status !== "done"));
    if (published) setFinished({ published, failed: ready - published, where: batch.trim() || null });
    setPublishing(false);
    onPublished?.();
  };

  const ready = items.filter((it) => it.status === "ready" || it.status === "failed").length;

  return (
    <>
      <DoneNote finished={finished} noun={["clip", "clips"]} onClose={() => setFinished(null)} />
      <BatchField type="footage" value={batch} onChange={setBatch} disabled={publishing} />
      {batchError && <p className="ad-error">{batchError}</p>}
      <div
        className={`ad-drop ${dragging ? "is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <strong>Drop MOV or MP4 clips here</strong>
        <span>
          One file per clip (a MOV and an MP4 with the same name count as one clip). Title and
          keywords come from the clip's metadata. Previews are recorded in this tab in real time,
          so keep it open and in front while publishing.
        </span>
        <button onClick={() => input.current?.click()}>Choose clips</button>
        <input ref={input} type="file" multiple accept=".mp4,.mov,.m4v,video/mp4,video/quicktime" hidden
               onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {items.length > 0 && (
        <>
          <div className="ad-bar">
            <UploadProgress run={run} items={items}>
              <span>{items.length} {items.length === 1 ? "clip" : "clips"}</span>
            </UploadProgress>
            <button className="ad-primary" onClick={publishAll} disabled={publishing || ready === 0}>
              {publishing ? "Publishing…" : `Publish ${ready}`}
            </button>
          </div>

          <div className="ad-list">
            {items.map((it) => {
              const locked = publishing || it.status === "done" || it.status === "uploading";
              const p = it.playable;
              return (
                <div className={`ad-item is-${it.status === "failed" ? "error" : it.status}`} key={it.base}>
                  <div className="ad-thumb ad-video">
                    {it.preview && <video src={it.preview} muted loop playsInline autoPlay />}
                  </div>
                  <div className="ad-fields">
                    <input value={it.title} placeholder="Short title" maxLength={80} aria-label="Title"
                           disabled={locked || !p} onChange={(e) => update(it.base, { title: e.target.value })} />
                    <div className="ad-row">
                      <select value={it.category} disabled={locked || !p} aria-label="Category"
                              onChange={(e) => update(it.base, { category: e.target.value })}>
                        {FOOTAGE_CATEGORIES.map((c) => <option key={c} value={c}>{capitalize(c)}</option>)}
                      </select>
                      <select value={it.license} disabled={locked || !p} aria-label="License"
                              onChange={(e) => update(it.base, { license: e.target.value })}>
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                      </select>
                      <label className={`ad-ai-chip ${it.aiGenerated ? "on" : ""}`} title="Made with generative AI">
                        <input type="checkbox" checked={Boolean(it.aiGenerated)} disabled={locked || !p}
                               onChange={(e) => update(it.base, { aiGenerated: e.target.checked })} />
                        AI
                      </label>
                      <span className="ad-file">
                        {it.files.map((f) => `${f.name.split(".").pop().toUpperCase()} ${mb(f.size)}`).join(" + ")}
                      </span>
                    </div>
                    {p && (
                      <p className="ad-keywords">
                        {p.width} × {p.height} · {clock(p.duration)}{it.fps ? ` · ${it.fps} fps` : ""}
                        {it.keywords.length > 0 && ` · ${it.keywords.slice(0, 10).join(", ")}${it.keywords.length > 10 ? " …" : ""}`}
                      </p>
                    )}
                  </div>
                  <div className="ad-status">
                    <span>{it.message}</span>
                    {it.status === "uploading" && (
                      <div className="ad-progress"><span style={{ width: `${Math.round(it.progress * 100)}%` }} /></div>
                    )}
                    {!locked && (
                      <button className="ad-remove" onClick={() => setItems((l) => l.filter((x) => x.base !== it.base))}>
                        Remove
                      </button>
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

export default FootageUpload;
