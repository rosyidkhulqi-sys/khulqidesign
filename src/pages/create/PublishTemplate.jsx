// "Publish as template" dialog in Create (admins only). Shows what will be
// published (size, pages, a preview of page 1), asks for the library
// details, then runs publishTemplate with progress.
import { useEffect, useState } from "react";
import { TEMPLATE_CATEGORIES, publishTemplate, renderPage } from "./templatePublish";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function PublishTemplate({ getDesign, defaultTitle, onClose }) {
  // the design is read once, when the dialog opens
  const [design] = useState(getDesign);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState(defaultTitle === "Untitled design" ? "" : defaultTitle);
  const [category, setCategory] = useState("social media");
  const [tags, setTags] = useState("");
  const [license, setLicense] = useState("free");
  const [state, setState] = useState({ step: null, progress: 0, error: null, code: null });

  useEffect(() => {
    let url;
    renderPage(design.pages[0], design.w, design.h, 420)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setPreview(url);
      })
      .catch(() => setPreview(null));
    return () => url && URL.revokeObjectURL(url);
  }, [design]);

  const empty = !design.pages.some((p) => p?.objects?.length);
  const busy = state.step && !state.code && !state.error;

  const publish = async () => {
    setState({ step: "Starting", progress: 0, error: null, code: null });
    try {
      const code = await publishTemplate(design, { title, category, tags, license }, (step, progress) =>
        setState((s) => ({ ...s, step, progress }))
      );
      setState({ step: "Done", progress: 1, error: null, code });
    } catch (e) {
      setState({ step: null, progress: 0, error: e.message, code: null });
    }
  };

  return (
    <div className="pt-overlay" onClick={busy ? undefined : onClose}>
      <div className="pt-dialog" role="dialog" aria-modal="true" aria-label="Publish as template" onClick={(e) => e.stopPropagation()}>
        <h2>Publish as template</h2>
        <p className="pt-sub">
          Buyers open this exact design in Create and change its text, colors and pictures.
        </p>

        <div className="pt-body">
          <div className="pt-preview" style={{ aspectRatio: `${design.w} / ${design.h}` }}>
            {preview ? <img src={preview} alt="Page 1" /> : <span>Preview…</span>}
          </div>

          <div className="pt-fields">
            <p className="pt-meta">
              {design.w} × {design.h} px · {design.pages.length} {design.pages.length === 1 ? "page" : "pages"}
            </p>
            <label>
              Title
              <input value={title} maxLength={80} placeholder="e.g. Big sale social post" disabled={busy || !!state.code}
                     onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Category
              <select value={category} disabled={busy || !!state.code} onChange={(e) => setCategory(e.target.value)}>
                {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{capitalize(c)}</option>)}
              </select>
            </label>
            <label>
              Tags
              <input value={tags} placeholder="sale, promo, instagram" disabled={busy || !!state.code}
                     onChange={(e) => setTags(e.target.value)} />
            </label>
            <label>
              License
              <select value={license} disabled={busy || !!state.code} onChange={(e) => setLicense(e.target.value)}>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </label>
          </div>
        </div>

        <ul className="pt-checks">
          <li>Use fonts from Create's font list so the text looks the same for buyers.</li>
          <li>Pictures you uploaded are published with the template; use your own work.</li>
        </ul>

        {state.error && <p className="pt-error">{state.error}</p>}
        {busy && (
          <div className="pt-progress">
            <span>{state.step}</span>
            <div><i style={{ width: `${Math.round(state.progress * 100)}%` }} /></div>
          </div>
        )}
        {state.code && <p className="pt-done">Published as {state.code}. It's now in Templates and in Create's Templates tab.</p>}

        <div className="pt-actions">
          <button onClick={onClose} disabled={busy}>{state.code ? "Close" : "Cancel"}</button>
          {!state.code && (
            <button className="pt-primary" onClick={publish} disabled={busy || empty || !title.trim()}>
              {busy ? "Publishing…" : "Publish"}
            </button>
          )}
        </div>
        {empty && <p className="pt-error">The design is empty.</p>}
      </div>
    </div>
  );
}

export default PublishTemplate;
