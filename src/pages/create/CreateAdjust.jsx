// The dock's Adjust section for a photo: Brightness, Contrast and Saturation
// first (free), then More with Temperature, Sharpen, Blur and the presets
// (Premium, marked with the crown; free to try, as Premium elements).
import { BASIC, PRESETS, PRO } from "./photoAdjust";
import { PremiumMark } from "./CreateElements";

function Slider({ label, value, min, onChange }) {
  return (
    <label className="cs-range-control">
      <span>{label}</span>
      <input type="range" min={min} max="100" step="1" value={value || 0}
             onChange={(e) => onChange(Number(e.target.value))} />
      <output>{value || 0}</output>
    </label>
  );
}

// adjust: the picture's settings; onChange(next settings); premium: the
// account has Premium (the crowns then stay off)
export default function CreateAdjust({ adjust = {}, onChange, premium }) {
  const set = (key, value) => onChange({ ...adjust, [key]: value });
  const pickPreset = (id, values) =>
    onChange(adjust.preset === id ? {} : { ...values, preset: id });
  return (
    <div className="ca-adjust">
      <div className="cs-panel">
        {BASIC.map(([key, label, min]) => (
          <Slider key={key} label={label} value={adjust[key]} min={min} onChange={(v) => set(key, v)} />
        ))}
      </div>

      <details className="pp-more ca-more" open={Boolean(PRO.some(([key]) => adjust[key]) || adjust.preset)}>
        <summary>More {!premium && <span className="ca-crown"><PremiumMark /></span>}</summary>
        <div className="cs-panel">
          {PRO.map(([key, label, min]) => (
            <Slider key={key} label={label} value={adjust[key]} min={min} onChange={(v) => set(key, v)} />
          ))}
        </div>
        <div className="ca-presets" role="group" aria-label="Presets">
          {PRESETS.map(([id, label, values]) => (
            <button key={id} type="button" className={adjust.preset === id ? "on" : ""}
                    aria-pressed={adjust.preset === id} onClick={() => pickPreset(id, values)}>
              {label}
            </button>
          ))}
        </div>
      </details>

      <button type="button" className="ca-reset" onClick={() => onChange({})}
              disabled={!Object.keys(adjust).length}>
        Reset to original
      </button>
    </div>
  );
}
