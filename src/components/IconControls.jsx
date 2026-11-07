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

// a quiet pill marking what a subscription includes
export function PremiumTag() {
  return <span className="ie-tag">Premium</span>;
}

// shown when a signed-out visitor clicks a Premium button
export function PremiumPrompt({ title, text, onAuth, onDismiss }) {
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
      </div>
    </div>
  );
}
