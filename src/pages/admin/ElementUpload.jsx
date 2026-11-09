// The Elements tab on /admin: parts for the Create editor. Drop SVG, PNG or
// JPG files; each one is an element or a background (JPGs start as backgrounds).
import { useRef, useState } from "react";
import { parseKeywords } from "./vectorUpload";
import { MAX_KEYWORDS, categoriesOf, isElementFile, missingField, publishElement, readElement } from "./elementPublish";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
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

  const publishAll = async () => {
    setPublishing(true);
    for (const item of items.filter((it) => it.status === "ready" || (it.status === "failed" && it.format))) {
      const missing = missingField(item);
      if (missing) {
        update(item.base, { status: "failed", message: `Add ${missing === "category" ? "a category" : missing === "title" ? "a title" : "keywords"} first` });
        continue;
      }
      update(item.base, { status: "uploading", progress: 0, message: "Preparing" });
      try {
        const code = await publishElement(item, (message, progress) => update(item.base, { message, progress }));
        update(item.base, { status: "done", progress: 1, message: `Published as ${code}` });
      } catch (e) {
        update(item.base, { status: "failed", message: e.message });
      }
    }
    setPublishing(false);
    onPublished?.();
  };

  const ready = items.filter((it) => it.status === "ready" || (it.status === "failed" && it.format)).length;
  const done = items.filter((it) => it.status === "done").length;

  return (
    <>
      <div
        className={`ad-drop ${dragging ? "is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <strong>Drop SVG, PNG or JPG files here</strong>
        <span>
          Each file becomes one part for Create. SVG stays recolorable, PNG keeps its transparency,
          and JPG starts as a background. Pictures over 3000 px are scaled down.
        </span>
        <button onClick={() => input.current?.click()}>Choose files</button>
        <input ref={input} type="file" multiple accept=".svg,.png,.jpg,.jpeg" hidden
               onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {items.length > 0 && (
        <>
          <div className="ad-bar">
            <span>{items.length} {items.length === 1 ? "file" : "files"}{done > 0 && ` · ${done} published`}</span>
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
              const locked = publishing || it.status === "done" || it.status === "uploading" || !it.format;
              return (
                <div className={`ad-item is-${it.status === "failed" ? "error" : it.status}`} key={it.base}>
                  <div className="ad-thumb is-icon"><img src={it.thumb} alt="" /></div>
                  <div className="ad-fields">
                    <input value={it.title} placeholder="Short title" maxLength={100} disabled={locked} aria-label="Title"
                           onChange={(e) => update(it.base, { title: e.target.value })} />
                    <div className="ad-row">
                      <select value={it.kind} disabled={locked} aria-label="Type"
                              onChange={(e) => update(it.base, { kind: e.target.value, category: "" })}>
                        <option value="element">Element</option>
                        <option value="background">Background</option>
                      </select>
                      <select value={it.category} disabled={locked} aria-label="Category"
                              onChange={(e) => update(it.base, { category: e.target.value })}>
                        <option value="" disabled>Category</option>
                        {categoriesOf(it.kind).map((c) => <option key={c} value={c}>{capitalize(c)}</option>)}
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
