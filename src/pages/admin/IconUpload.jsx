// The Icons tab on /admin: pick or create a set, drop SVGs, publish.
import { useEffect, useRef, useState } from "react";
import {
  ICON_CATEGORIES,
  ICON_STYLES,
  createIconSet,
  listIconSets,
  nameFromFile,
  publishIcon,
  readSvg,
  splitKeywords,
} from "./iconPublish";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const emptySet = { name: "", style: "outline", category: "business", license: "free", description: "", keywords: "" };

function IconUpload({ onPublished }) {
  const [sets, setSets] = useState([]);
  // "" = new set, otherwise an existing set id
  const [setId, setSetId] = useState("");
  const [draft, setDraft] = useState(emptySet);
  const [items, setItems] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const input = useRef(null);
  const urls = useRef([]);

  useEffect(() => {
    let alive = true;
    listIconSets()
      .then((list) => alive && setSets(list))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const chosen = sets.find((s) => s.id === setId) ?? null;
  const license = chosen?.license ?? draft.license;
  const styleOfSet = chosen?.style ?? draft.style;

  const update = (key, patch) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const addFiles = async (fileList) => {
    const svgs = [...fileList].filter((f) => /\.svg$/i.test(f.name) && !items.some((it) => it.key === f.name));
    const fresh = svgs.map((file) => {
      const preview = URL.createObjectURL(file);
      urls.current.push(preview);
      return { key: file.name, file, preview, name: nameFromFile(file.name), keywords: "", license, status: "reading", message: "Reading SVG", progress: 0 };
    });
    setItems((list) => [...list, ...fresh]);

    for (const item of fresh) {
      try {
        const svg = await readSvg(item.file);
        update(item.key, {
          svg,
          // the file name's words start the keywords
          keywords: item.name.toLowerCase().split(" ").filter((w) => w.length > 1).join(", "),
          status: "ready",
          message: `${svg.colors} ${svg.colors === 1 ? "color" : "colors"} · looks ${svg.style}`,
        });
      } catch {
        update(item.key, { status: "error", message: "Not a valid SVG" });
      }
    }

    // a new set takes the style its first file looks like
    if (!setId && !items.length && fresh.length) {
      try {
        const first = await readSvg(fresh[0].file);
        setDraft((d) => ({ ...d, style: first.style }));
      } catch {
        /* keep the chosen style */
      }
    }
  };

  const publishAll = async () => {
    setError(null);
    let set = chosen;
    if (!set) {
      if (!draft.name.trim()) {
        setError("Give the new set a name first.");
        return;
      }
      setPublishing(true);
      try {
        set = await createIconSet(draft);
        setSets((list) => [set, ...list]);
        setSetId(set.id);
      } catch (e) {
        setError(e.message);
        setPublishing(false);
        return;
      }
    }
    setPublishing(true);
    for (const item of items.filter((it) => it.status === "ready" || it.status === "failed")) {
      update(item.key, { status: "uploading", progress: 0, message: "Preparing" });
      try {
        const code = await publishIcon(
          { ...item, keywords: splitKeywords(item.keywords), name: item.name.trim() || "Icon" },
          set,
          (message, progress) => update(item.key, { message, progress })
        );
        update(item.key, { status: "done", progress: 1, message: `Published as ${code}` });
      } catch (e) {
        update(item.key, { status: "failed", message: e.message });
      }
    }
    setPublishing(false);
    onPublished?.();
  };

  const ready = items.filter((it) => it.status === "ready" || it.status === "failed").length;
  const done = items.filter((it) => it.status === "done").length;
  const lockSet = publishing || done > 0;

  return (
    <>
      {/* SET */}
      <div className="ad-set">
        <label className="ad-set-pick">
          <span>Icon set</span>
          <select value={setId} disabled={lockSet} onChange={(e) => setSetId(e.target.value)}>
            <option value="">+ New set</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {capitalize(s.style ?? "")} · {s.license === "free" ? "Free" : "Premium"}</option>
            ))}
          </select>
        </label>

        {!chosen && (
          <div className="ad-set-form">
            <input placeholder="Set name, e.g. Shopping & Promo" value={draft.name} maxLength={60} disabled={lockSet}
                   onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Set name" />
            <div className="ad-row">
              <select value={draft.style} disabled={lockSet} onChange={(e) => setDraft({ ...draft, style: e.target.value })} aria-label="Style">
                {ICON_STYLES.map((s) => <option key={s} value={s}>{capitalize(s)}</option>)}
              </select>
              <select value={draft.category} disabled={lockSet} onChange={(e) => setDraft({ ...draft, category: e.target.value })} aria-label="Category">
                {ICON_CATEGORIES.map((c) => <option key={c} value={c}>{capitalize(c)}</option>)}
              </select>
              <select value={draft.license} disabled={lockSet}
                      onChange={(e) => {
                        setDraft({ ...draft, license: e.target.value });
                        setItems((list) => list.map((it) => (it.status === "done" ? it : { ...it, license: e.target.value })));
                      }} aria-label="Default license">
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <input placeholder="Short description (optional)" value={draft.description} maxLength={140} disabled={lockSet}
                   onChange={(e) => setDraft({ ...draft, description: e.target.value })} aria-label="Description" />
            <input placeholder="Keywords for every icon in the set, comma separated" value={draft.keywords} disabled={lockSet}
                   onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} aria-label="Set keywords" />
          </div>
        )}
        {chosen?.description && <p className="ad-file">{chosen.description}</p>}
      </div>

      {/* DROP ZONE */}
      <div
        className={`ad-drop ${dragging ? "is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <strong>Drop SVG icons here</strong>
        <span>
          One SVG per icon, ideally on a square artboard. Names come from the file names.
          Every file is cleaned of scripts before it goes online.
        </span>
        <button onClick={() => input.current?.click()}>Choose SVG files</button>
        <input ref={input} type="file" multiple accept=".svg,image/svg+xml" hidden
               onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {error && <p className="ad-error">{error}</p>}

      {items.length > 0 && (
        <>
          <div className="ad-bar">
            <span>
              {items.length} {items.length === 1 ? "icon" : "icons"}{done > 0 && ` · ${done} published`}
              {styleOfSet && ` · set style ${styleOfSet}`}
            </span>
            {done > 0 && (
              <button onClick={() => setItems((l) => l.filter((it) => it.status !== "done"))} disabled={publishing}>
                Clear published
              </button>
            )}
            <button className="ad-primary" onClick={publishAll} disabled={publishing || ready === 0}>
              {publishing ? "Publishing…" : `Publish ${ready}`}
            </button>
          </div>

          <div className="ad-icon-grid">
            {items.map((it) => {
              const locked = publishing || it.status === "done" || it.status === "uploading";
              const mismatch = it.svg && it.svg.style !== styleOfSet;
              return (
                <div className={`ad-icon is-${it.status}`} key={it.key}>
                  <div className="ad-icon-preview"><img src={it.preview} alt="" /></div>
                  <input value={it.name} maxLength={60} disabled={locked} aria-label="Icon name"
                         onChange={(e) => update(it.key, { name: e.target.value })} />
                  <input value={it.keywords} placeholder="keywords" disabled={locked} aria-label="Keywords"
                         onChange={(e) => update(it.key, { keywords: e.target.value })} />
                  <div className="ad-row">
                    <select value={it.license} disabled={locked} aria-label="License"
                            onChange={(e) => update(it.key, { license: e.target.value })}>
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                    {!locked && (
                      <button className="ad-remove" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>Remove</button>
                    )}
                  </div>
                  <span className="ad-icon-status">
                    {mismatch && it.status === "ready" ? `Looks ${it.svg.style}, set is ${styleOfSet}` : it.message}
                  </span>
                  {it.status === "uploading" && (
                    <div className="ad-progress"><span style={{ width: `${Math.round(it.progress * 100)}%` }} /></div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

export default IconUpload;
