// The Brand tab: a Premium member's official colors, fonts and logos, kept
// with their account and ready in every design. Click a color to paint the
// selection (or the page when nothing is selected), a logo to place it.
import { useRef, useState } from "react";
import FontPicker from "./FontPicker";
import Icon from "./CreateIcons";
import { MAX_COLORS, MAX_LOGOS, MAX_LOGO_BYTES } from "../../lib/brandKit";

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

function CreateBrand({ kit, onChange, canUse, signedIn, onUseColor, onUseLogo, onLogin, saving, error }) {
  const [adding, setAdding] = useState("#1b2a4a");
  const [note, setNote] = useState(null);
  const fileInput = useRef(null);

  if (!canUse) {
    return (
      <div className="cb-locked">
        <span className="cb-badge">Premium</span>
        <h3>Your brand, in every design</h3>
        <p>Keep your official colors, heading and body fonts, and logos in one place, ready in every design you make.</p>
        {signedIn ? (
          <a className="ct-btn primary" href="/pricing">See plans</a>
        ) : (
          <button className="ct-btn primary" onClick={onLogin}>Log in</button>
        )}
      </div>
    );
  }

  const addLogos = async (files) => {
    setNote(null);
    const room = MAX_LOGOS - kit.logos.length;
    const picked = [...files].filter((f) => /svg|png|jpe?g|webp/i.test(f.type || f.name)).slice(0, room);
    const tooBig = picked.filter((f) => f.size > MAX_LOGO_BYTES);
    const ok = picked.filter((f) => f.size <= MAX_LOGO_BYTES);
    const logos = await Promise.all(ok.map(async (f) => ({ name: f.name.replace(/\.[a-z0-9]+$/i, ""), src: await readAsDataUrl(f) })));
    if (logos.length) onChange({ ...kit, logos: [...kit.logos, ...logos] });
    if (tooBig.length) setNote(`${tooBig.map((f) => f.name).join(", ")}: logos must be under ${MAX_LOGO_BYTES / 1024} KB. An SVG or a small PNG works best.`);
  };

  return (
    <div className="cb">
      <section>
        <div className="cb-head">
          <p className="cp-label">Brand colors</p>
          <small>{kit.colors.length}/{MAX_COLORS}</small>
        </div>
        <div className="cb-colors">
          {kit.colors.map((c, i) => (
            <span key={`${c}-${i}`} className="cb-color">
              <button style={{ background: c }} onClick={() => onUseColor(c)} title={`Use ${c}`} aria-label={`Use ${c}`} />
              <button
                className="cb-remove"
                onClick={() => onChange({ ...kit, colors: kit.colors.filter((_, j) => j !== i) })}
                aria-label={`Remove ${c}`}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {kit.colors.length < MAX_COLORS && (
          <div className="cb-add">
            <label className="cb-pick" style={{ background: adding }} title="Pick a color">
              <input type="color" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Pick a brand color" />
            </label>
            <span className="cb-hex">{adding.toUpperCase()}</span>
            <button
              className="ct-btn"
              disabled={kit.colors.includes(adding)}
              onClick={() => onChange({ ...kit, colors: [...kit.colors, adding] })}
            >
              <Icon name="plus" size={14} /> Add
            </button>
          </div>
        )}
        <p className="cp-hint">Click a color to use it on the selection, or on the page when nothing is selected.</p>
      </section>

      <section>
        <p className="cp-label">Brand fonts</p>
        <span className="cb-font-label">Headings</span>
        <FontPicker value={kit.headingFont ?? "Space Grotesk"} onPick={(f) => onChange({ ...kit, headingFont: f })} />
        <span className="cb-font-label">Body text</span>
        <FontPicker value={kit.bodyFont ?? "DM Sans"} onPick={(f) => onChange({ ...kit, bodyFont: f })} />
        <p className="cp-hint">New text from the Text tab uses these fonts.</p>
      </section>

      <section>
        <div className="cb-head">
          <p className="cp-label">Logos</p>
          <small>{kit.logos.length}/{MAX_LOGOS}</small>
        </div>
        <div className="cb-logos">
          {kit.logos.map((logo, i) => (
            <span key={i} className="cb-logo">
              <button onClick={() => onUseLogo(logo.src)} title={`Add ${logo.name}`}>
                <img src={logo.src} alt={logo.name} />
              </button>
              <button
                className="cb-remove"
                onClick={() => onChange({ ...kit, logos: kit.logos.filter((_, j) => j !== i) })}
                aria-label={`Remove ${logo.name}`}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
          {kit.logos.length < MAX_LOGOS && (
            <button className="cb-add-logo" onClick={() => fileInput.current?.click()}>
              <Icon name="plus" size={16} />
              <span>Logo</span>
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp"
          multiple
          hidden
          onChange={(e) => {
            addLogos(e.target.files);
            e.target.value = "";
          }}
        />
        {note && <p className="cb-note">{note}</p>}
      </section>

      <p className="cb-status" aria-live="polite">
        {error ? error : saving ? "Saving…" : "Saved to your account"}
      </p>
    </div>
  );
}

export default CreateBrand;
