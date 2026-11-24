// The Fonts tab on /admin, as a Creative Market listing: drop the buyer's
// ZIP (or loose OTF, TTF, WOFF2 and license files) and up to 8 preview
// pictures, check the name, the description (what's included is written
// from the ZIP) and the price of each license tier, publish.
import { useEffect, useMemo, useRef, useState } from "react";
import DoneNote from "./DoneNote";
import BatchField from "./BatchField";
import KeywordChips from "./KeywordChips";
import NumberInput from "../../components/NumberInput";
import { openBatch } from "./batches";
import {
  FONT_ACCEPT, FONT_CATEGORIES, FONT_EXTS, FONT_TIERS, IMAGE_EXTS, LICENSE_EXTS, MAX_PREVIEWS,
  describePackage, isLicense, missingParts, publishFont, readFontNames, readZip, withAdded,
} from "./fontPublish";

const extOf = (name) => name.split(".").pop().toLowerCase();
const mb = (bytes) => `${(bytes / 1_000_000).toFixed(bytes < 1_000_000 ? 2 : 1)} MB`;

const blank = () => ({
  zip: null,
  loose: [],
  // license files to put into the ZIP
  added: [],
  pack: null,
  font: null,
  previews: [],
  title: "",
  description: "",
  keywords: [],
  category: "display",
  prices: Object.fromEntries(FONT_TIERS.map(([id, , price]) => [id, price])),
});

function FontUpload({ onPublished }) {
  const [item, setItem] = useState(blank);
  const [batch, setBatch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [finished, setFinished] = useState(null);
  const input = useRef(null);
  const patch = (changes) => setItem((it) => ({ ...it, ...changes }));

  // small pictures of the previews, freed when they change
  const thumbs = useMemo(() => item.previews.map((f) => URL.createObjectURL(f)), [item.previews]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  const addFiles = async (dropped) => {
    setError(null);
    setReading(true);
    try {
      const zip = dropped.find((f) => extOf(f.name) === "zip");
      const images = dropped.filter((f) => IMAGE_EXTS.includes(extOf(f.name)))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const loose = dropped.filter((f) => [...FONT_EXTS, ...LICENSE_EXTS].includes(extOf(f.name)));
      const next = {};

      // a license dropped beside a ZIP is put into the ZIP when it goes up
      // (only license files, and only ones the ZIP doesn't have already)
      const licenses = loose.filter((f) => LICENSE_EXTS.includes(extOf(f.name)));
      if (zip || (item.zip && licenses.length && licenses.length === loose.length)) {
        const read = zip ? await readZip(zip) : item.pack;
        const inZip = new Set(read.files.map((p) => p.split("/").pop()));
        const added = [...(zip ? [] : item.added), ...licenses.filter((f) =>
          isLicense(f.name) && !inZip.has(f.name) && !item.added.some((x) => x.name === f.name))];
        // the ZIP's own previews, when none were dropped beside it
        if (zip && !images.length && !item.previews.length && read.previews?.length) images.push(...read.previews);
        Object.assign(next, {
          zip: zip ?? item.zip,
          loose: [],
          added,
          pack: added.length ? withAdded(read, added) : read,
          font: zip ? read.font : item.font,
        });
      } else if (loose.length) {
        const all = [...item.loose, ...loose.filter((f) => !item.loose.some((x) => x.name === f.name))];
        Object.assign(next, {
          zip: null,
          loose: all,
          pack: describePackage(all.map((f) => f.name)),
          font: all.find((f) => ["otf", "ttf"].includes(extOf(f.name))) ?? null,
        });
      }

      const previews = [...item.previews, ...images.filter((f) => !item.previews.some((x) => x.name === f.name))];
      if (previews.length > MAX_PREVIEWS) setError(`Up to ${MAX_PREVIEWS} previews: the first ${MAX_PREVIEWS} are kept.`);
      next.previews = previews.slice(0, MAX_PREVIEWS);

      const font = next.font ?? item.font;
      if (!item.title && font) {
        const names = await readFontNames(font).catch(() => null);
        if (names) next.title = names.family;
      }
      patch(next);
    } catch (e) {
      setError(`Couldn't read the files: ${e.message}`);
    } finally {
      setReading(false);
    }
  };

  const removePackage = () => patch({ zip: null, loose: [], added: [], pack: null, font: null });
  const removePreview = (i) => patch({ previews: item.previews.filter((_, j) => j !== i) });
  const makeCover = (i) => patch({ previews: [item.previews[i], ...item.previews.filter((_, j) => j !== i)] });

  const lacks = item.pack ? missingParts(item) : [];
  const ready = item.pack && lacks.length === 0;

  const publish = async () => {
    if (!item.title.trim()) {
      setError("Give the font a name first.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const batchId = await openBatch("font", batch);
      await publishFont({ ...item, batchId, title: item.title.trim() }, (message, progress) =>
        setStatus({ message, progress }));
      setFinished({ published: 1, failed: 0, where: batch.trim() || null });
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
        <strong>{reading ? "Reading…" : "Drop the font's ZIP and its previews here"}</strong>
        <span>
          The ZIP is what the buyer gets, as it is (or drop loose OTF, TTF, WOFF2 and license files).
          Add up to {MAX_PREVIEWS} JPG or PNG previews: the first is the cover. Sold per item, not in the subscription.
        </span>
        <button onClick={() => input.current?.click()} disabled={publishing || reading}>Choose files</button>
        <input ref={input} type="file" multiple accept={FONT_ACCEPT} hidden
               onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
      </div>

      {(item.pack || item.previews.length > 0) && (
        <div className="ad-font">
          {item.pack ? (
            <div className="ad-font-pack">
              <div>
                <strong>{item.zip ? item.zip.name : `${item.loose.length} files, packed into one ZIP`}</strong>
                <span className="ad-file">
                  {item.zip ? `${mb(item.zip.size)} · ` : ""}{item.pack.fonts.length} font files ({item.pack.formats.join(", ") || "none"})
                  {item.pack.hasLicense ? " · license" : ""}
                </span>
                {item.added.length > 0 && (
                  <span className="ad-file">Added into the ZIP: {item.added.map((f) => f.name).join(", ")}</span>
                )}
              </div>
              {!publishing && <button className="ad-remove" onClick={removePackage}>Remove</button>}
            </div>
          ) : (
            <p className="ad-error">Still needs the font's ZIP (or its OTF or TTF and license files).</p>
          )}
          {lacks.length > 0 && <p className="ad-error">The package still needs {lacks.join(" and ")}.</p>}

          {/* the previews in order: the first is the cover, as on Creative Market */}
          <div className="ad-font-previews">
            {item.previews.map((f, i) => (
              <figure key={f.name} className={i === 0 ? "is-cover" : ""}>
                {thumbs[i] && <img src={thumbs[i]} alt="" />}
                <figcaption>
                  {i === 0 ? "Cover" : (
                    <button type="button" onClick={() => makeCover(i)} disabled={publishing}>Make cover</button>
                  )}
                </figcaption>
                {!publishing && (
                  <button type="button" className="ad-icon-remove" onClick={() => removePreview(i)} aria-label={`Remove ${f.name}`}>×</button>
                )}
              </figure>
            ))}
            {item.previews.length === 0 && (
              <p className="ad-note ad-font-nopreview">No previews yet: drop JPG or PNG pictures, or a specimen will be drawn from the font.</p>
            )}
          </div>

          <div className="ad-fields">
            <input value={item.title} placeholder="Font name, e.g. Omanut" maxLength={80} disabled={publishing}
                   onChange={(e) => patch({ title: e.target.value })} aria-label="Font name" />
            <div className="ad-row">
              <select value={item.category} disabled={publishing} aria-label="Category"
                      onChange={(e) => patch({ category: e.target.value })}>
                {FONT_CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <textarea value={item.description} rows={4} maxLength={1200} disabled={publishing}
                      placeholder="Description (optional): the font's character and what it suits. The files are listed on the page already."
                      onChange={(e) => patch({ description: e.target.value })} aria-label="Description" />
            <KeywordChips compact label="Keywords" value={item.keywords} min={3} max={30}
                          onChange={(list) => patch({ keywords: list })} />
            {/* your own price per license tier, as font shops sell them */}
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
            <span>
              {status
                ? `${status.message}${status.progress ? ` · ${Math.round(status.progress * 100)}%` : ""}`
                : `${item.previews.length} of ${MAX_PREVIEWS} previews`}
            </span>
            <button className="ad-primary" onClick={publish} disabled={publishing || reading || !ready}>
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
