// The Elements tab on /admin: parts for the Create editor. Drop SVG, PNG or
// JPG files; each one is an element or a background (JPGs start as backgrounds).
import { useRef, useState } from "react";
import DoneNote from "./DoneNote";
import BatchField from "./BatchField";
import { openBatch } from "./batches";
import UploadProgress from "./UploadProgress";
import useUploadRun from "./useUploadRun";

// elements published at the same time (SVGs are small), as icons go up
const ELEMENTS_AT_ONCE = 6;
import { parseKeywords } from "./vectorUpload";
import {
  MAX_KEYWORDS,
  backgroundCategoryLabel,
  categoriesOf,
  elementCategoryLabel,
  isElementFile,
  missingField,
  publishElement,
  readElement,
} from "./elementPublish";

const mb = (bytes) => `${(bytes / 1_000_000).toFixed(1)} MB`;

// type keywords with commas or Enter; each becomes a tag, up to the limit
function KeywordField({ keywords, disabled, onChange }) {
  const [draft, setDraft] = useState("");
  const full = keywords.length >= MAX_KEYWORDS;

  const add = (text) => {
    onChange(parseKeywords([...keywords, text].join(",")).slice(0, MAX_KEYWORDS));
    setDraft("");
  };

  return (
    <>
      <input
        value={draft}
        placeholder={full ? `${MAX_KEYWORDS} keywords reached` : "Separate multiple keywords using commas"}
        disabled={disabled || full}
        aria-label="Keywords"
        onChange={(e) => (/[,;\n]/.test(e.target.value) ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (draft.trim()) add(draft);
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
      {keywords.length > 0 && (
        <div className="ad-tags">
          {keywords.map((k) => (
            <button key={k} type="button" className="ad-tag" disabled={disabled} aria-label={`Remove ${k}`}
                    onClick={() => onChange(keywords.filter((x) => x !== k))}>
              {k} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ElementUpload({ onPublished }) {
  const [items, setItems] = useState([]);
  const [publishing, setPublishing] = useState(false);
  // the last publish: how many went up, how many failed
  const [finished, setFinished] = useState(null);
  const [batch, setBatch] = useState("");
  const [batchError, setBatchError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);

  const update = (base, patch) => setItems((list) => list.map((it) => (it.base === base ? { ...it, ...patch } : it)));

  const addFiles = async (fileList) => {
    const known = new Set(items.map((it) => it.base));
    const fresh = [...fileList]
      .filter((f) => isElementFile(f) && !known.has(f.name))
      .map((file) => ({
        base: file.name,
        file,
        thumb: URL.createObjectURL(file),
        title: "",
        format: "",
        kind: "element",
        category: "",
        license: "free",
        description: "",
        keywords: [],
        status: "reading",
        message: "Reading the file",
        progress: 0,
      }));
    setItems((list) => [...list, ...fresh]);

    for (const item of fresh) {
      try {
        const info = await readElement(item.file);
        update(item.base, { ...info, status: "ready", message: `${info.width} × ${info.height}` });
      } catch (e) {
        update(item.base, { status: "failed", message: e.message });
      }
    }
  };

  const [run, pool] = useUploadRun();

  const publishAll = async () => {
    setPublishing(true);
    setFinished(null);
    let published = 0;
    let batchId;
    try {
      batchId = await openBatch("element", batch);
    } catch (e) {
      setBatchError(e.message);
      setPublishing(false);
      return;
    }
    setBatchError(null);
    // six at a time, and the tab stays alive in the background meanwhile
    const queue = items.filter((it) => it.status === "ready" || (it.status === "failed" && it.format));
    await pool(queue, ELEMENTS_AT_ONCE, async (item) => {
      const missing = missingField(item);
      if (missing) {
        update(item.base, { status: "failed", message: `Add ${missing === "category" ? "a category" : missing === "title" ? "a title" : "keywords"} first` });
        return;
      }
      update(item.base, { status: "uploading", progress: 0, message: "Preparing" });
      try {
        const code = await publishElement({ ...item, batchId }, (message, progress) => update(item.base, { message, progress }));
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

  const ready = items.filter((it) => it.status === "ready" || (it.status === "failed" && it.format)).length;

  return (
    <>
      <DoneNote finished={finished} noun={["file", "files"]} onClose={() => setFinished(null)} />
      <BatchField type="element" value={batch} onChange={setBatch} disabled={publishing} />
      {batchError && <p className="ad-error">{batchError}</p>}
      <div
        className={`ad-drop ${dragging ? "is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <strong>Drop SVG, PNG or JPG files here</strong>
        <span>
          Each file becomes one part for Create. SVG stays recolorable, PNG keeps its transparency,
          and JPG starts as a background. To add a reusable photo, choose Element → Photos. Icon sets
          are managed on the Icons tab and appear in Create automatically. Pictures over 3000 px are scaled down.
        </span>
        <button onClick={() => input.current?.click()}>Choose files</button>
        <input ref={input} type="file" multiple accept=".svg,.png,.jpg,.jpeg" hidden
               onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {items.length > 0 && (
        <>
          <div className="ad-bar">
            <UploadProgress run={run} items={items}>
              <span>{items.length} {items.length === 1 ? "file" : "files"}</span>
            </UploadProgress>
            <button className="ad-primary" onClick={publishAll} disabled={publishing || ready === 0}>
              {publishing ? "Publishing…" : `Publish ${ready}`}
            </button>
          </div>

          <div className="ad-list">
            {items.map((it) => {
              const locked = publishing || it.status === "done" || it.status === "uploading" || !it.format;
              return (
                <div className={`ad-item is-${it.status === "failed" ? "error" : it.status}`} key={it.base}>
                  <div className="ad-thumb is-icon"><img src={it.thumb} alt="" /></div>
                  <div className="ad-fields">
                    <input value={it.title} placeholder="Short title" maxLength={100} disabled={locked} aria-label="Title"
                           onChange={(e) => update(it.base, { title: e.target.value })} />
                    <div className="ad-row">
                      <select value={it.kind} disabled={locked} aria-label="Type"
                              onChange={(e) => update(it.base, { kind: e.target.value, category: e.target.value === "element" ? "graphics" : "" })}>
                        <option value="element">Element</option>
                        <option value="background">Background</option>
                      </select>
                      <select value={it.category} disabled={locked} aria-label="Category"
                              onChange={(e) => update(it.base, { category: e.target.value })}>
                        <option value="" disabled>Category</option>
                        {categoriesOf(it.kind).map((c) => (
                          <option key={c} value={c}>
                            {it.kind === "background" ? backgroundCategoryLabel(c) : elementCategoryLabel(c)}
                          </option>
                        ))}
                      </select>
                      <select value={it.license} disabled={locked} aria-label="License"
                              onChange={(e) => update(it.base, { license: e.target.value })}>
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>
                    <KeywordField keywords={it.keywords} disabled={locked}
                                  onChange={(keywords) => update(it.base, { keywords })} />
                    <p className="ad-keywords">
                      {it.format} {mb(it.file.size)} · {it.keywords.length}/{MAX_KEYWORDS} keywords
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

export default ElementUpload;
