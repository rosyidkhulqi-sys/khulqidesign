// Edit an image, step one: Recolor. Pick a picture, see its main colors,
// click one and choose a new color; every part in that color changes, with
// its shading kept. Premium members can lay their brand colors on in one
// click. Free and unlimited: it runs on this device, with no model and no
// tokens. Downloading needs an account, as with the other tools; the edit is
// kept while the visitor logs in.
import { useEffect, useRef, useState } from "react";
import "./ImageTool.css";
import { askLogin } from "../../lib/authGate";
import { forgetResult, keepResult, restoreResult } from "../../lib/aiKeep";
import { fetchBrandKit } from "../../lib/brandKit";
import { blobOf, hexOf, paletteOf, recolorCanvas, rgbOf, scaledCanvas } from "../../lib/recolor";

const ACCEPT = "image/png,image/jpeg,image/webp";
const PREVIEW_SIDE = 1200;
const FULL_SIDE = 4096;

function RecolorTool({ user }) {
  const [file, setFile] = useState(null);
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [preview, setPreview] = useState(null); // the picture at preview size
  const [palette, setPalette] = useState([]);
  const [changes, setChanges] = useState([]); // new color per palette entry, or null
  const [brand, setBrand] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const pickers = useRef([]);

  useEffect(() => () => before && URL.revokeObjectURL(before), [before]);
  useEffect(() => () => after && URL.revokeObjectURL(after), [after]);

  // a Premium member's brand colors, for "Brand colors"
  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchBrandKit(user.id).then((kit) => alive && setBrand(kit.colors)).catch(() => {});
    return () => { alive = false; };
  }, [user]);

  // reads a picture: its preview and its colors; `kept` puts a kept edit back
  const open = async (f, kept = null) => {
    setError(null);
    setFile(f);
    setBefore(URL.createObjectURL(f));
    setAfter(null);
    try {
      const canvas = await scaledCanvas(f, PREVIEW_SIDE);
      const colors = paletteOf(canvas);
      setPreview(canvas);
      setPalette(colors);
      setChanges(colors.map((_, i) => (kept?.[i] ? rgbOf(kept[i]) : null)));
    } catch {
      setError("This picture couldn't be read. Try a PNG, JPG or WebP.");
    }
  };

  // back from logging in to download: the same picture and edit
  useEffect(() => {
    restoreResult("edit").then((k) => k && open(k.file, k.option));
  }, []);

  // the preview follows every change, a moment after the last one
  useEffect(() => {
    if (!preview || !palette.length) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const out = await recolorCanvas(preview, palette, changes);
      const blob = await blobOf(out);
      if (alive) setAfter(URL.createObjectURL(blob));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [preview, palette, changes]);

  const pick = (list) => {
    const f = [...list].find((x) => /^image\/(png|jpeg|webp)$/.test(x.type));
    if (!f) {
      setError("Choose a PNG, JPG or WebP picture.");
      return;
    }
    open(f);
  };

  const setColor = (i, hex) => setChanges((list) => list.map((c, j) => (j === i ? rgbOf(hex) : c)));
  const reset = () => setChanges(palette.map(() => null));

  // brand colors, in order, onto the picture's colors that aren't near white
  // or near black (backgrounds and outlines usually stay)
  const applyBrand = () => {
    const neutral = (rgb) => Math.max(...rgb) - Math.min(...rgb) < 18 && (rgb[0] > 225 || rgb[0] < 40);
    let n = 0;
    setChanges(palette.map((c) => (!neutral(c.rgb) && n < brand.length ? rgbOf(brand[n++]) : null)));
  };

  const clear = () => {
    forgetResult();
    setFile(null);
    setBefore(null);
    setAfter(null);
    setPreview(null);
    setPalette([]);
    setChanges([]);
    setError(null);
  };

  const download = async () => {
    const kept = changes.map((c) => (c ? hexOf(c) : null));
    if (!user) {
      const blob = await (await fetch(after)).blob();
      await keepResult("edit", file, blob, kept);
      askLogin("result");
      return;
    }
    setSaving(true);
    try {
      // the download is made from the full-size picture, not the preview
      const full = await scaledCanvas(file, FULL_SIDE);
      const out = await recolorCanvas(full, palette, changes);
      const url = URL.createObjectURL(await blobOf(out));
      forgetResult();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\.[^.]+$/, "")}-recolored.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(e.message || "The picture couldn't be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const changed = changes.some(Boolean);

  return (
    <div className="it">
      {!file ? (
        <div
          className={`it-drop ${dragging ? "is-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}
        >
          <strong>Drop a picture here</strong>
          <span>PNG, JPG or WebP. It's recolored on this device and never uploaded.</span>
          <button onClick={() => input.current?.click()}>Choose a picture</button>
        </div>
      ) : (
        <>
          <div className="it-compare">
            <figure>
              <figcaption>Before</figcaption>
              <div className="it-frame"><img src={before} alt="Before" /></div>
            </figure>
            <figure>
              <figcaption>After</figcaption>
              <div className="it-frame">
                {after ? <img src={after} alt="After" /> : <span className="it-wait">Reading the colors…</span>}
              </div>
            </figure>
          </div>

          {/* the picture's colors: click one to change it */}
          {palette.length > 0 && (
            <div className="rc-colors">
              <span className="rc-label">Colors</span>
              {palette.map((c, i) => (
                <label key={i} className={`rc-swatch ${changes[i] ? "is-changed" : ""}`}
                       title={`${hexOf(c.rgb)} · ${Math.round(c.share * 100)}% of the picture`}>
                  <span className="rc-new" style={{ background: hexOf(changes[i] ?? c.rgb) }} />
                  {changes[i] && <span className="rc-old" style={{ background: hexOf(c.rgb) }} />}
                  <input
                    ref={(el) => (pickers.current[i] = el)}
                    type="color"
                    value={hexOf(changes[i] ?? c.rgb)}
                    onChange={(e) => setColor(i, e.target.value)}
                    aria-label={`Change ${hexOf(c.rgb)}`}
                  />
                </label>
              ))}
              {brand.length > 0 && <button className="rc-link" onClick={applyBrand}>Brand colors</button>}
              {changed && <button className="rc-link" onClick={reset}>Reset</button>}
            </div>
          )}

          <div className="it-actions">
            <button onClick={clear} disabled={saving} title="Remove this picture and start again">Remove</button>
            <button onClick={() => input.current?.click()} disabled={saving}>Choose another</button>
            <button className="it-primary" onClick={download} disabled={!changed || !after || saving}>
              {saving ? "Saving…" : "Download PNG"}
            </button>
          </div>
        </>
      )}

      <input ref={input} type="file" accept={ACCEPT} hidden
             onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />

      {error && <p className="it-error">{error}</p>}

      <p className="it-note">
        Click a color, choose a new one: everything in that color changes, its shading kept. Runs on your
        device, free and unlimited. Works best on flat artwork like vectors and logos.
      </p>
    </div>
  );
}

export default RecolorTool;
