// The Logos tab on /admin: drop a JPG preview with its source files (AI,
// EPS, SVG, PDF, PNG; same file name), set industry, style and license,
// and a USD price for Exclusive logos.
import { useEffect, useRef, useState } from "react";
import BatchField from "./BatchField";
import { openBatch } from "./batches";
import { industries, logoStyles } from "../../data/logosData";
import { pairLogos, publishLogo, readLogo, sourceLabel } from "./logoPublish";
import NumberInput from "../../components/NumberInput";

const mb = (bytes) => `${(bytes / 1_000_000).toFixed(1)} MB`;

function LogoUpload({ onPublished }) {
  const [items, setItems] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [batch, setBatch] = useState("");
  const [batchError, setBatchError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const urls = useRef([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const update = (base, patch) => setItems((list) => list.map((it) => (it.base === base ? { ...it, ...patch } : it)));

  const addFiles = async (fileList) => {
    const groups = pairLogos([...fileList]).filter((g) => !items.some((it) => it.base === g.base));
    const fresh = groups.map((g) => {
      const thumb = g.jpg ? URL.createObjectURL(g.jpg) : null;
      if (thumb) urls.current.push(thumb);
      return {
        ...g,
        thumb,
        title: "",
        longTitle: "",
        description: "",
        keywords: [],
        industry: industries[0][0],
        style: logoStyles[0][0],
        license: "premium",
        price: 199,
        status: g.jpg ? "reading" : "incomplete",
        message: g.jpg ? "Reading metadata" : "Add a JPG preview with the same name",
        progress: 0,
      };
    });
    setItems((list) => [...list, ...fresh]);

    for (const item of fresh.filter((it) => it.status === "reading")) {
      const meta = await readLogo(item.jpg);
      update(item.base, {
        ...meta,
        status: "ready",
        message: item.sources.length
          ? `${meta.keywords.length} keywords`
          : "No source files (AI, EPS, SVG…); buyers would only get the JPG",
      });
    }
  };

  const publishAll = async () => {
    setPublishing(true);
    let batchId;
    try {
      batchId = await openBatch("logo", batch);
    } catch (e) {
      setBatchError(e.message);
      setPublishing(false);
      return;
    }
    setBatchError(null);
    for (const item of items.filter((it) => it.status === "ready" || it.status === "failed")) {
      if (!item.title.trim()) {
        update(item.base, { status: "failed", message: "Add a title first" });
        continue;
      }
      update(item.base, { status: "uploading", progress: 0, message: "Preparing" });
      try {
        const code = await publishLogo({ ...item, batchId }, (message, progress) => update(item.base, { message, progress }));
        update(item.base, { status: "done", progress: 1, message: `Published as ${code}` });
      } catch (e) {
        update(item.base, { status: "failed", message: e.message });
      }
    }
    setPublishing(false);
    onPublished?.();
  };

  const ready = items.filter((it) => it.status === "ready" || it.status === "failed").length;
  const done = items.filter((it) => it.status === "done").length;

  return (
    <>
      <BatchField type="logo" value={batch} onChange={setBatch} disabled={publishing} />
      {batchError && <p className="ad-error">{batchError}</p>}
      <div
        className={`ad-drop ${dragging ? "is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <strong>Drop logo files here</strong>
        <span>
          One JPG preview per logo plus its source files with the same name (AI, EPS, SVG, PDF, PNG).
          Title and keywords come from the JPG's metadata. Premium and Exclusive previews get the
          watermark in their pixels.
        </span>
        <button onClick={() => input.current?.click()}>Choose files</button>
        <input ref={input} type="file" multiple accept=".jpg,.jpeg,.ai,.eps,.svg,.pdf,.png" hidden
               onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {items.length > 0 && (
        <>
          <div className="ad-bar">
            <span>{items.length} {items.length === 1 ? "logo" : "logos"}{done > 0 && ` · ${done} published`}</span>
            {done > 0 && (
              <button onClick={() => setItems((l) => l.filter((it) => it.status !== "done"))} disabled={publishing}>
                Clear published
              </button>
            )}
            <button className="ad-primary" onClick={publishAll} disabled={publishing || ready === 0}>
              {publishing ? "Publishing…" : `Publish ${ready}`}
            </button>
          </div>

          <div className="ad-list">
            {items.map((it) => {
              const locked = publishing || it.status === "done" || it.status === "uploading" || it.status === "incomplete";
              return (
                <div className={`ad-item is-${it.status === "failed" ? "error" : it.status}`} key={it.base}>
                  <div className="ad-thumb">{it.thumb && <img src={it.thumb} alt="" />}</div>
                  <div className="ad-fields">
                    <input value={it.title} placeholder="Short title" maxLength={80} disabled={locked} aria-label="Title"
                           onChange={(e) => update(it.base, { title: e.target.value })} />
                    <div className="ad-row">
                      <select value={it.industry} disabled={locked} aria-label="Industry"
                              onChange={(e) => update(it.base, { industry: e.target.value })}>
                        {industries.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                      </select>
                      <select value={it.style} disabled={locked} aria-label="Style"
                              onChange={(e) => update(it.base, { style: e.target.value })}>
                        {logoStyles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                      </select>
                      <select value={it.license} disabled={locked} aria-label="License"
                              onChange={(e) => update(it.base, { license: e.target.value })}>
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                        <option value="exclusive">Exclusive</option>
                      </select>
                      {it.license === "exclusive" && (
                        <label className="ad-price">
                          $
                          <NumberInput min="1" step="1" value={it.price} disabled={locked} aria-label="Price in USD"
                                 onChange={(e) => update(it.base, { price: Number(e.target.value) })} />
                        </label>
                      )}
                    </div>
                    <p className="ad-keywords">
                      {it.jpg ? `JPG ${mb(it.jpg.size)}` : "No JPG"}
                      {it.sources.map((f) => ` + ${sourceLabel(f)} ${mb(f.size)}`).join("")}
                      {it.keywords.length > 0 && ` · ${it.keywords.slice(0, 10).join(", ")}${it.keywords.length > 10 ? " …" : ""}`}
                    </p>
                  </div>
                  <div className="ad-status">
                    <span>{it.message}</span>
                    {it.status === "uploading" && (
                      <div className="ad-progress"><span style={{ width: `${Math.round(it.progress * 100)}%` }} /></div>
                    )}
                    {!(publishing || it.status === "done" || it.status === "uploading") && (
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

export default LogoUpload;
