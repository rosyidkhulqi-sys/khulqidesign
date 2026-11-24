// The Icons tab on /admin: pick or create a set, drop SVGs, publish.
import { askConfirm } from "../../lib/confirm";
import { useEffect, useRef, useState } from "react";
import BatchField from "./BatchField";
import { openBatch } from "./batches";
import KeywordChips from "./KeywordChips";
import { clearDraft, loadDraft, saveDraft } from "../../lib/drafts";
import { runPool } from "../../lib/uploadPool";
import { supabase } from "../../lib/supabaseClient";
import {
  GENERIC_ICON_WORDS,
  ICON_CATEGORIES,
  ICON_STYLES,
  createIconSet,
  listIconSets,
  nameFromFile,
  publishIcon,
  iconsOfSet,
  planIcons,
  readSvg,
  splitKeywords,
} from "./iconPublish";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const emptySet = { name: "", style: "outline", category: "business", license: "free", description: "", keywords: "" };
const DRAFT_KEY = "icon-upload";
// icons published at the same time
const ICONS_AT_ONCE = 12;

// "Add user" -> "add user, user, add"; "Money bag" -> "money bag, bag, money"
const keywordsFromName = (name) => {
  const words = name.toLowerCase().split(/\s+/).filter((w) => w.length > 1 && !GENERIC_ICON_WORDS.has(w));
  const phrase = words.join(" ");
  return [...new Set([words.length > 1 ? phrase : null, ...words.reverse()].filter(Boolean))].join(", ");
};

function IconUpload({ onPublished }) {
  const [sets, setSets] = useState([]);
  // "" = new set, otherwise an existing set id
  const [setId, setSetId] = useState("");
  const [draft, setDraft] = useState(emptySet);
  const [items, setItems] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [batch, setBatch] = useState("");
  const [batchError, setBatchError] = useState(null);
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

  // Icons added but not published yet are kept in this browser with their
  // names, keywords and license, and come back after a refresh.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let alive = true;
    const patch = (key, change) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...change } : it)));
    loadDraft(DRAFT_KEY).then(async (saved) => {
      if (!alive) return;
      if (saved?.items?.length) {
        setSetId(saved.setId ?? "");
        setDraft(saved.draft ?? emptySet);
        setBatch(saved.batch ?? "");
        const back = saved.items.map((it) => {
          const preview = URL.createObjectURL(it.file);
          urls.current.push(preview);
          return { ...it, preview, status: "reading", message: "", progress: 0 };
        });
        setItems(back);
        for (const it of back) {
          try {
            const svg = await readSvg(it.file);
            if (alive) patch(it.key, { svg, status: "ready" });
          } catch {
            if (alive) patch(it.key, { status: "error", message: "Not a valid SVG" });
          }
        }
      }
      if (alive) setRestored(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!restored) return;
    const waiting = items.filter((it) => it.status !== "done" && it.file);
    const timer = setTimeout(() => {
      if (!waiting.length) clearDraft(DRAFT_KEY);
      else saveDraft(DRAFT_KEY, { setId, draft, batch, items: waiting.map(({ key, file, name, keywords, license }) => ({ key, file, name, keywords, license })) });
    }, 400);
    return () => clearTimeout(timer);
  }, [restored, items, draft, setId, batch]);

  const chosen = sets.find((s) => s.id === setId) ?? null;
  const license = chosen?.license ?? draft.license;
  const styleOfSet = chosen?.style ?? draft.style;

  const update = (key, patch) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const addFiles = async (fileList) => {
    setFinished(null);
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
        // a title and keywords written into the SVG (KD Create) come first;
        // without them the name starts the keywords: the whole name first
        // ("add user"), then its words, the last (usually the subject) first
        const name = svg.meta.title || item.name;
        update(item.key, {
          svg,
          name,
          keywords: svg.meta.keywords.length ? svg.meta.keywords.join(", ") : keywordsFromName(name),
          status: "ready",
          message: "",
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

  // The same set in another style (Glyph after Outline): copy the set's
  // details, with the style word swapped in its name and description, and
  // each icon's name and keywords from the icon with the same file name.
  const [copying, setCopying] = useState(false);
  const copyFrom = async (sourceId) => {
    const source = sets.find((s) => s.id === sourceId);
    if (!source) return;
    setCopying(true);
    try {
      const icons = await iconsOfSet(source.id);
      const style = capitalize(draft.style);
      const swap = (text) => (text ?? "").replace(/\b(outline|glyph|flat|gradient|hand-drawn|hand drawn)\b/gi, style);
      if (!chosen) setDraft((d) => ({
        ...d,
        name: swap(source.name),
        description: swap(source.description),
        category: source.category ?? d.category,
        license: source.license ?? d.license,
        keywords: (source.keywords ?? []).join(", "),
      }));
      const byFile = new Map(icons.map((i) => [(i.source_name ?? "").toLowerCase(), i]));
      const byTitle = new Map(icons.map((i) => [(i.title ?? "").toLowerCase(), i]));
      const twinOf = (it) => byFile.get(it.key.replace(/\.svg$/i, "").toLowerCase()) ?? byTitle.get(it.name.toLowerCase());
      const matched = items.filter((it) => it.status !== "done" && twinOf(it)).length;
      setItems((list) => list.map((it) => {
        if (it.status === "done") return it;
        const twin = twinOf(it);
        const license = chosen ? it.license : source.license ?? it.license;
        if (!twin) return { ...it, license };
        return { ...it, name: twin.title, keywords: (twin.keywords ?? []).join(", "), license };
      }));
      setError(null);
      setCopyNote(`Copied from ${source.name}: ${matched} of ${items.length} icons matched by file name.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setCopying(false);
    }
  };
  const [copyNote, setCopyNote] = useState(null);
  const [copyQuery, setCopyQuery] = useState("");
  const setLabel = (s) => `${s.name} · ${capitalize(s.style ?? "")} · ${s.code}`;

  // a new set with the name and style of one already uploaded: the icons
  // most likely belong in that one (the same name in another style is fine)
  const tidy = (s) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const twin = !chosen && tidy(draft.name)
    ? sets.find((s) => tidy(s.name) === tidy(draft.name) && s.style === draft.style)
    : null;

  const publishAll = async () => {
    setError(null);
    if (twin) {
      setError(`A ${twin.style} set named "${twin.name}" already exists. Choose "Use that set", or give this set another name.`);
      return;
    }
    let set = chosen;
    // the set picked may have been deleted since this page loaded (under
    // Uploaded icon sets): say so instead of failing every icon
    if (set) {
      const { data: still } = await supabase.from("asset_sets").select("id").eq("id", set.id).maybeSingle();
      if (!still) {
        setSets((list) => list.filter((s) => s.id !== set.id));
        setSetId("");
        setError(`The set "${set.name}" was deleted. Choose another set, or make a new one with + New set.`);
        return;
      }
    }
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
    let batchId;
    try {
      batchId = await openBatch("icon", batch);
    } catch (e) {
      setBatchError(e.message);
      setPublishing(false);
      return;
    }
    setBatchError(null);
    // several icons at once, as The Noun Project does; each still reports
    // its own progress and failure
    const queue = items.filter((it) => it.status === "ready" || it.status === "failed");
    queue.forEach((it) => update(it.key, { status: "uploading", progress: 0, message: "Waiting" }));
    // every upload link of the batch in one call; if that fails, each icon
    // simply signs its own links as before
    const plans = await planIcons(queue).catch(() => ({}));
    const worker = async (item) => {
      {
        update(item.key, { message: "Preparing" });
        try {
          const code = await publishIcon(
            { ...item, batchId, keywords: splitKeywords(item.keywords), name: item.name.trim() || "Icon", plan: plans[item.key] },
            set,
            (message, progress) => update(item.key, { message, progress })
          );
          update(item.key, { status: "done", progress: 1, message: `Published as ${code}` });
          published += 1;
        } catch (e) {
          update(item.key, { status: "failed", message: e.message });
          failed += 1;
        }
      }
    };
    let published = 0;
    let failed = 0;
    await runPool(queue, ICONS_AT_ONCE, worker);
    // as on The Noun Project: the published cards go, a Done note stays, and
    // only icons that failed are left to try again
    setItems((list) => list.filter((it) => it.status !== "done"));
    setFinished({ published, failed, setName: set.name });
    setPublishing(false);
    onPublished?.();
  };
  const [finished, setFinished] = useState(null);

  const ready = items.filter((it) => it.status === "ready" || it.status === "failed").length;
  const done = items.filter((it) => it.status === "done").length;
  const lockSet = publishing || done > 0;

  return (
    <>
      {/* 1. the files first, as on The Noun Project; the set's details
          and the batch follow once there is something to describe */}
      {finished && finished.published > 0 && (
        <div className={`ad-done ${finished.failed ? "has-failed" : ""}`} role="status">
          <span className="ad-done-check" aria-hidden="true">✓</span>
          <div>
            <strong>Done · {finished.published} {finished.published === 1 ? "icon" : "icons"} published</strong>
            <span>
              In {finished.setName}.{" "}
              {finished.failed ? `${finished.failed} failed: they stay below, press Publish to try them again.` : "They're on the site now."}
            </span>
          </div>
          <button onClick={() => setFinished(null)} aria-label="Close">×</button>
        </div>
      )}
      <div
        className={`ad-drop ${dragging ? "is-over" : ""} ${items.length ? "is-small" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <strong>{items.length ? "Drop more SVG icons" : "Drop SVG icons here"}</strong>
        {!items.length && (
          <span>
            One SVG per icon, ideally on a square artboard. Names come from the file names.
            Every file is cleaned of scripts before it goes online.
          </span>
        )}
        <button onClick={() => input.current?.click()}>{items.length ? "Add files" : "Choose SVG files"}</button>
        <input ref={input} type="file" multiple accept=".svg,image/svg+xml" hidden
               onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {items.length > 0 && (
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

          {sets.length > 0 && !publishing && (
            <div className="ad-copy">
              {/* type part of a published set's name, pick it: its details are copied
                (into an existing set: only the icons' names and keywords) */}
              <input
                list="ad-copy-sets"
                value={copyQuery}
                disabled={copying}
                placeholder={copying ? "Copying…" : chosen ? "Copy icon names and keywords from another set: type its name or code" : "Copy details from a published set: type its name or code"}
                aria-label="Copy details from a set"
                onChange={(e) => {
                  const text = e.target.value;
                  const hit = sets.find((s) => setLabel(s) === text);
                  if (hit) {
                    setCopyQuery("");
                    copyFrom(hit.id);
                  } else {
                    setCopyQuery(text);
                  }
                }}
              />
              <datalist id="ad-copy-sets">
                {sets.filter((s) => s.id !== chosen?.id).map((s) => <option key={s.id} value={setLabel(s)} />)}
              </datalist>
              {copyNote && <span>{copyNote}</span>}
            </div>
          )}

          {!chosen && (
            <div className="ad-set-form">
              <input placeholder="Set name, e.g. Shopping & Promo" value={draft.name} maxLength={60} disabled={lockSet}
                     onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Set name"
                     style={twin ? { borderColor: "#ff5c66" } : undefined} />
              {twin && (
                <p className="ad-batch-taken" style={{ marginLeft: 0 }} role="alert">
                  <span>A {capitalize(twin.style ?? "")} set named "{twin.name}" already exists.</span>
                  <button type="button" onClick={() => setSetId(twin.id)}>Use that set</button>
                </p>
              )}
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
              <KeywordChips
                compact
                label="Set keywords (find the set; each icon keeps its own)"
                value={splitKeywords(draft.keywords)}
                onChange={(list) => setDraft({ ...draft, keywords: list.join(", ") })}
                min={2}
                max={15}
                banned={GENERIC_ICON_WORDS}
                disabled={lockSet}
              />
            </div>
          )}
          {chosen?.description && <p className="ad-file">{chosen.description}</p>}
          {chosen && (
            <p className="ad-hint">
              These icons are added to this {capitalize(chosen.style ?? "")} set, with its details. For the same icons in another
              style, choose <b>+ New set</b> and copy this set&apos;s details. To change this set&apos;s details, use Edit under
              Uploaded icon sets.
            </p>
          )}
        </div>

        <BatchField type="icon" value={batch} onChange={setBatch} disabled={publishing} />
        {batchError && <p className="ad-error">{batchError}</p>}
        </>
      )}

      {error && <p className="ad-error">{error}</p>}

      {items.length > 0 && (
        <>
          <div className="ad-bar">
            <span>
              {items.length} {items.length === 1 ? "icon" : "icons"}{done > 0 && ` · ${done} published`}
              {styleOfSet && ` · set style ${styleOfSet}`}
            </span>
            {/* empties this upload (nothing published is touched) */}
            <button onClick={async () => {
              const sure = await askConfirm({
                title: `Remove all ${items.length} icons from this upload?`,
                message: "They're only taken off this list; nothing on the site changes.",
                confirmLabel: "Remove all",
              });
              if (sure) setItems((l) => l.filter((it) => it.status === "done" || it.status === "uploading"));
            }} disabled={publishing}>Remove all</button>
            <button className="ad-primary" onClick={publishAll} disabled={publishing || ready === 0}>
              {publishing ? "Publishing…" : `Publish ${ready}`}
            </button>
          </div>

          <div className="ad-icon-grid">
            {items.map((it) => {
              const locked = publishing || it.status === "done" || it.status === "uploading";
              return (
                <div className={`ad-icon is-${it.status}`} key={it.key}>
                  <div className="ad-icon-preview">
                    <img src={it.preview} alt="" />
                    {/* out of this upload before publishing, in the corner where it's seen */}
                    {!locked && (
                      <button className="ad-icon-remove" aria-label={`Remove ${it.name || "icon"}`} title="Remove"
                              onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>×</button>
                    )}
                  </div>
                  <input value={it.name} maxLength={60} disabled={locked} aria-label="Icon name" spellCheck lang="en"
                         onChange={(e) => update(it.key, { name: e.target.value })} />
                  <KeywordChips
                    compact
                    value={splitKeywords(it.keywords)}
                    onChange={(list) => update(it.key, { keywords: list.join(", ") })}
                    min={3}
                    max={30}
                    banned={GENERIC_ICON_WORDS}
                    disabled={locked}
                  />
                  <div className="ad-row">
                    <select value={it.license} disabled={locked} aria-label="License"
                            onChange={(e) => update(it.key, { license: e.target.value })}>
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  {it.message && <span className="ad-icon-status">{it.message}</span>}
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
