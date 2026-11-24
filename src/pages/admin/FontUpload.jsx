// The Fonts tab on /admin: drop one family's files (OTF, TTF, WOFF2 and the
// license file), check its name, category and tier prices, publish. The
// family name is read from the font itself.
import { useRef, useState } from "react";
import DoneNote from "./DoneNote";
import BatchField from "./BatchField";
import KeywordChips from "./KeywordChips";
import NumberInput from "../../components/NumberInput";
import { openBatch } from "./batches";
import {
  FONT_ACCEPT, FONT_CATEGORIES, FONT_TIERS, missingParts, publishFont, readFontNames, sortFontFiles,
} from "./fontPublish";

const blank = () => ({
  fonts: [],
  licenses: [],
  title: "",
  description: "",
  keywords: [],
  category: "display",
  prices: Object.fromEntries(FONT_TIERS.map(([id, , price]) => [id, price])),
});

const mb = (bytes) => `${(bytes / 1_000_000).toFixed(bytes < 1_000_000 ? 2 : 1)} MB`;

function FontUpload({ onPublished }) {
  const [item, setItem] = useState(blank);
  const [batch, setBatch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [finished, setFinished] = useState(null);
  const input = useRef(null);
  const patch = (changes) => setItem((it) => ({ ...it, ...changes }));

  const addFiles = async (dropped) => {
    const { fonts, licenses } = sortFontFiles(dropped);
    const known = new Set([...item.fonts, ...item.licenses].map((f) => f.name));
    const next = {
      fonts: [...item.fonts, ...fonts.filter((f) => !known.has(f.name))],
      licenses: [...item.licenses, ...licenses.filter((f) => !known.has(f.name))],
    };
    let title = item.title;
    if (!title) {
      for (const f of next.fonts) {
        const names = await readFontNames(f).catch(() => null);
        if (names) {
          title = names.family;
          break;
        }
      }
    }
    setError(null);
    patch({ ...next, title });
  };

  const removeFile = (name) => setItem((it) => ({
    ...it,
    fonts: it.fonts.filter((f) => f.name !== name),
    licenses: it.licenses.filter((f) => f.name !== name),
  }));

  const lacks = missingParts(item);
  const files = [...item.fonts, ...item.licenses];

  const publish = async () => {
    if (!item.title.trim()) {
      setError("Give the font a name first.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const batchId = await openBatch("font", batch);
      const code = await publishFont({ ...item, batchId, title: item.title.trim() }, (message, progress) =>
        setStatus({ message, progress }));
      setFinished({ published: 1, failed: 0, where: batch.trim() || null, code });
      setItem(blank());
      onPublished?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setStatus(null);
      setPublishing(false);
    }
  };

  return (
    <>
      <DoneNote finished={finished} noun={["font", "fonts"]} onClose={() => setFinished(null)} />
      <BatchField type="font" value={batch} onChange={setBatch} disabled={publishing} />
      <div
        className={`ad-drop ${dragging ? "is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles([...e.dataTransfer.files]); }}
      >
        <strong>Drop one font family here</strong>
        <span>
          Its OTF, TTF and WOFF2 files and the license file (PDF or TXT) go to the buyer as one ZIP.
          The site shows a specimen drawn from the font, never the font file. Sold per item, not in the subscription.
        </span>
        <button onClick={() => input.current?.click()} disabled={publishing}>Choose files</button>
        <input ref={input} type="file" multiple accept={FONT_ACCEPT} hidden
               onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
      </div>

      {files.length > 0 && (
        <div className="ad-font">
          <ul className="ad-font-files">
            {files.map((f) => (
              <li key={f.name}>
                <span>{f.name}</span>
                <span className="ad-file">{mb(f.size)}</span>
                {!publishing && (
                  <button className="ad-remove" onClick={() => removeFile(f.name)} aria-label={`Remove ${f.name}`}>Remove</button>
                )}
              </li>
            ))}
          </ul>
          {lacks.length > 0 && <p className="ad-error">Still needs {lacks.join(", ")}.</p>}

          <div className="ad-fields">
            <input value={item.title} placeholder="Font name, e.g. Bauhaus Grotesk" maxLength={80} disabled={publishing}
                   onChange={(e) => patch({ title: e.target.value })} aria-label="Font name" />
            <div className="ad-row">
              <select value={item.category} disabled={publishing} aria-label="Category"
                      onChange={(e) => patch({ category: e.target.value })}>
                {FONT_CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <input value={item.description} placeholder="Short description (optional)" maxLength={300} disabled={publishing}
                   onChange={(e) => patch({ description: e.target.value })} aria-label="Description" />
            <KeywordChips compact label="Keywords" value={item.keywords} min={3} max={30}
                          onChange={(list) => patch({ keywords: list })} />
            {/* one price per license tier, as font shops sell them */}
            <div className="ad-font-prices">
              {FONT_TIERS.map(([id, label]) => (
                <label key={id} className="ad-price">
                  <span>{label}</span>
                  $
                  <NumberInput min="1" step="1" value={item.prices[id]} disabled={publishing} aria-label={`${label} price in USD`}
                               onChange={(e) => patch({ prices: { ...item.prices, [id]: Number(e.target.value) } })} />
                </label>
              ))}
            </div>
          </div>

          <div className="ad-bar">
            <span>{status ? `${status.message}${status.progress ? ` · ${Math.round(status.progress * 100)}%` : ""}` : `${item.fonts.length} font files · ${item.licenses.length} license`}</span>
            <button className="ad-primary" onClick={publish} disabled={publishing || lacks.length > 0}>
              {publishing ? "Publishing…" : "Publish font"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="ad-error">{error}</p>}
    </>
  );
}

export default FontUpload;
