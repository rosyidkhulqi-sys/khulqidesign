// Small controls shared by the icon detail view and the icon set page.
// Styles live in IconModal.css.
import { iconSizes } from "../lib/iconEditor";
import "./IconModal.css";

export function Swatches({ list, value, onChange, label }) {
  return (
    <div className="ie-swatches" role="radiogroup" aria-label={label}>
      {list.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          className={value === c ? "active" : ""}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="ie-picker" title="Custom color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span>{value.toUpperCase()}</span>
      </label>
    </div>
  );
}

// one size for every download and copy button
export function SizePicker({ value, onChange }) {
  return (
    <div className="ie-sizes" role="radiogroup" aria-label="Size in pixels">
      {iconSizes.map((s) => (
        <button
          key={s}
          role="radio"
          aria-checked={value === s}
          className={value === s ? "active" : ""}
          onClick={() => onChange(s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// Transform button glyphs, drawn as SVG so all four share one stroke and size
// (text arrows like ⇆ ⇅ render in different fonts and weights).
const glyphs = {
  rotateLeft: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 3 3 8 8 8" />
    </>
  ),
  rotateRight: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <polyline points="21 3 21 8 16 8" />
    </>
  ),
  flipX: (
    <>
      <polyline points="7 4 3 8 7 12" />
      <line x1="3" y1="8" x2="21" y2="8" />
      <polyline points="17 12 21 16 17 20" />
      <line x1="21" y1="16" x2="3" y2="16" />
    </>
  ),
  flipY: (
    <>
      <polyline points="4 7 8 3 12 7" />
      <line x1="8" y1="3" x2="8" y2="21" />
      <polyline points="12 17 16 21 20 17" />
      <line x1="16" y1="21" x2="16" y2="3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <polyline points="7 10 12 15 17 10" />
      <path d="M5 20h14" />
    </>
  ),
  heart: (
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  ),
  play: <path d="M8 5.5v13l10-6.5z" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

// filled: a solid shape, for a saved heart
export function ToolGlyph({ name, size = 18, filled = false }) {
  return (
    <svg
      className="tool-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyphs[name]}
    </svg>
  );
}

// a quiet pill marking what a subscription includes
export function PremiumTag() {
  return <span className="ie-tag">Premium</span>;
}

// shown when a signed-out visitor clicks a Premium button; signedIn: a
// member on the Free plan, who only needs the way to Premium
export function PremiumPrompt({ title, text, onAuth, onDismiss, signedIn = false }) {
  if (signedIn) {
    return (
      <div className="ie-upsell" role="status">
        <button className="ie-upsell-close" onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
        <strong>{title}</strong>
        <p>{text}</p>
        <div>
          <button className="ie-upsell-main" onClick={() => onAuth("pricing")}>See plans</button>
        </div>
      </div>
    );
  }
  return (
    <div className="ie-upsell" role="status">
      <button className="ie-upsell-close" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
      <strong>{title}</strong>
      <p>
        {text} Plans are coming soon. Log in to keep downloading during the preview.
      </p>
      <div>
        <button className="ie-upsell-main" onClick={() => onAuth("login")}>Log in</button>
        <button onClick={() => onAuth("register")}>Create account</button>
        <button onClick={() => onAuth("pricing")}>See plans</button>
      </div>
    </div>
  );
}
