// The Mockup Studio: a mockup with each design area (a bottle's label, a
// cup's sleeve, a card) filled from an upload or a page of the design, drawn
// live as Photoshop would (src/lib/mockupRender.js). Add to page puts the
// result on the canvas as a picture that remembers its designs, so a
// double-click opens it here again; Download saves it at full size.
//
// mockup: { code, title, premium }; designs: saved pictures per design area
// (data URLs, or null for the sample); pages and board: the design, for "Use
// page"; onAdd(picture, designs); onClose; user: who's signed in (downloads
// ask to sign in first, as everywhere on the site).
import { useEffect, useRef, useState } from "react";
import { loadKit, renderMockup } from "../../../lib/mockupRender";
import { mockupKitUrl } from "../../../data/mockupKits";
import { askLogin } from "../../../lib/authGate";
import { pageImage } from "./pageImage";
import Icon from "../CreateIcons";

const makeCanvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error("A picture of the mockup couldn't be loaded."));
  img.src = src;
});

// a picture fitted whole into a design area of the given shape (contain,
// centered), so a logo on a clear background sits on the surface itself
function fitted(img, [w, h]) {
  const c = makeCanvas(w, h);
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  c.getContext("2d").drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}

// a canvas as a smaller data URL, for keeping in the design
function shrink(canvas, maxSide, type = "image/webp", quality = 0.9) {
  const s = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  const c = makeCanvas(canvas.width * s, canvas.height * s);
  c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL(type, quality);
}

export default function MockupStudio({ mockup, designs: savedDesigns = [], pages = [], board, onAdd, onClose, user }) {
  const [kit, setKit] = useState(null);
  const [error, setError] = useState(null);
  // per design area: a canvas fitted to it, or null for the mockup's sample
  const [designs, setDesigns] = useState([]);
  const [busy, setBusy] = useState(null);
  const preview = useRef(null);
  const fileFor = useRef(null);
  const input = useRef(null);

  // the kit, then any designs this mockup already had
  useEffect(() => {
    let alive = true;
    loadKit(mockupKitUrl(mockup.code), loadImage, makeCanvas)
      .then(async (loaded) => {
        const restored = await Promise.all(loaded.kit.designs.map((d, n) =>
          savedDesigns[n] ? loadImage(savedDesigns[n]).then((img) => fitted(img, d.content)).catch(() => null) : null));
        if (!alive) return;
        setKit(loaded);
        setDesigns(restored);
      })
      .catch((e) => alive && setError(e.message || "This mockup couldn't be opened."));
    return () => { alive = false; };
    // opened once per mockup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockup.code]);

  // drawn again whenever a design changes
  useEffect(() => {
    if (!kit || !preview.current) return;
    const out = renderMockup({ kit: kit.kit, images: kit.images, designs, makeCanvas });
    const c = preview.current;
    c.width = out.width;
    c.height = out.height;
    c.getContext("2d").drawImage(out, 0, 0);
  }, [kit, designs]);

  const setDesign = (n, canvas) => setDesigns((list) => {
    const next = [...list];
    next[n] = canvas;
    return next;
  });

  const upload = (n) => {
    fileFor.current = n;
    input.current?.click();
  };
  const onFile = (file) => {
    const n = fileFor.current;
    if (!file || n == null) return;
    const url = URL.createObjectURL(file);
    loadImage(url)
      .then((img) => setDesign(n, fitted(img, kit.kit.designs[n].content)))
      .catch((e) => setError(e.message))
      .finally(() => URL.revokeObjectURL(url));
  };
  // withBackground false: only what's on the page (a logo, a text), so it sits
  // on the surface as if printed; true: the whole page, as a full label
  const fillFromPage = async (n, index, withBackground) => {
    setBusy("Drawing the page");
    try {
      const img = await loadImage(await pageImage(pages[index], board, 2500, { background: withBackground }));
      setDesign(n, fitted(img, kit.kit.designs[n].content));
    } catch (e) {
      setError(e.message || "That page couldn't be drawn.");
    }
    setBusy(null);
  };

  const finished = () => renderMockup({ kit: kit.kit, images: kit.images, designs, makeCanvas });

  const add = () => {
    const out = finished();
    // kept small: designs live in this browser until projects move to accounts
    onAdd(shrink(out, 1600, "image/jpeg", 0.88), designs.map((d) => (d ? shrink(d, 1200) : null)), kit.kit.designs.map((d) => d.name));
  };

  const download = () => {
    if (!user) {
      askLogin("download");
      return;
    }
    const a = document.createElement("a");
    a.href = finished().toDataURL("image/jpeg", 0.92);
    a.download = `${mockup.code}-${mockup.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.jpg`;
    a.click();
  };

  return (
    <div className="create-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="create-modal ms-studio" role="dialog" aria-label={`Mockup: ${mockup.title}`}>
        <div className="ms-head">
          <h2>{mockup.title}</h2>
          <button className="ms-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>
        {error && <p className="ms-error" role="alert">{error}</p>}
        <div className="ms-body">
          <div className="ms-preview">
            {kit ? <canvas ref={preview} aria-label="Mockup preview" /> : <span className="ms-wait">Opening the mockup…</span>}
          </div>
          {kit && (
            <aside className="ms-side">
              <p className="cp-label">Design areas</p>
              {kit.kit.designs.map((d, n) => (
                <div key={d.name} className="ms-slot">
                  <div className="ms-slot-head">
                    <strong>{d.name}</strong>
                    <span>{Math.round(d.content[0])} × {Math.round(d.content[1])}</span>
                  </div>
                  <div className="ms-slot-actions">
                    <button type="button" onClick={() => upload(n)}>Upload</button>
                    {pages.length > 0 && (
                      <select value="" aria-label={`Use a page for ${d.name}`}
                              onChange={(e) => {
                                if (e.target.value === "") return;
                                const [i, bg] = e.target.value.split(":");
                                fillFromPage(n, Number(i), bg === "bg");
                              }}>
                        <option value="">Use page…</option>
                        {pages.map((_, i) => (
                          <optgroup key={i} label={`Page ${i + 1}`}>
                            <option value={`${i}:clear`}>Page {i + 1}, no background</option>
                            <option value={`${i}:bg`}>Page {i + 1}, with background</option>
                          </optgroup>
                        ))}
                      </select>
                    )}
                    {designs[n] && <button type="button" onClick={() => setDesign(n, null)} title="Back to the sample">Reset</button>}
                  </div>
                </div>
              ))}
              {busy && <p className="cp-hint">{busy}…</p>}
              <p className="cp-hint">Tip: "no background" prints just the logo or text on the surface; "with background" fills the area with the whole page. A page the size shown fits its area exactly.</p>
              <div className="ms-actions">
                <button type="button" className="ms-primary" onClick={add}>Add to page</button>
                <button type="button" onClick={download}>Download</button>
              </div>
            </aside>
          )}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
               onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}
