// The design brief for Template from text, filled in before generating, the
// way a client briefs a designer: the size, a style, the colors, and the
// parts the design must hold (with the exact text, or left for the AI to
// write). Everything is optional; Auto lets the AI decide.
import { artboardPresets } from "../create/createLibrary";
import { BRIEF_FIELDS } from "../../lib/aiTemplate";

const STYLES = [
  ["auto", "Auto"],
  ["minimal", "Minimal"],
  ["bold", "Bold"],
  ["elegant", "Elegant"],
  ["corporate", "Corporate"],
  ["playful", "Playful"],
  ["editorial", "Editorial"],
];

// a small box in the format's proportions
function Ratio({ w, h }) {
  const s = 14 / Math.max(w, h);
  return <span className="tb-ratio" style={{ width: Math.round(w * s), height: Math.round(h * s) }} />;
}

function TemplateBrief({ brief, onChange }) {
  const set = (patch) => onChange({ ...brief, ...patch });
  const toggleField = (field) => {
    const content = { ...brief.content };
    if (field in content) delete content[field];
    else content[field] = "";
    set({ content });
  };
  const chosen = BRIEF_FIELDS.filter(([id, , example]) => id in brief.content && example !== null);

  return (
    <div className="tb">
      <div className="tb-row">
        <span className="tb-label">Size</span>
        <div className="tb-chips">
          <button type="button" className={brief.format === "auto" ? "active" : ""} onClick={() => set({ format: "auto" })}>
            Auto
          </button>
          {artboardPresets.map((p) => (
            <button
              type="button"
              key={p.label}
              className={brief.format === p.label ? "active" : ""}
              onClick={() => set({ format: p.label })}
              title={`${p.w} × ${p.h} px`}
            >
              <Ratio w={p.w} h={p.h} /> {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tb-row">
        <span className="tb-label">Style</span>
        <div className="tb-chips">
          {STYLES.map(([id, label]) => (
            <button type="button" key={id} className={brief.style === id ? "active" : ""} onClick={() => set({ style: id })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="tb-row">
        <span className="tb-label">Colors</span>
        <div className="tb-chips">
          <button type="button" className={brief.colors.length === 0 ? "active" : ""} onClick={() => set({ colors: [] })}>
            Auto
          </button>
          {brief.colors.map((c, i) => (
            <span className="tb-color" key={i}>
              <label style={{ background: c }} title="Change color">
                <input
                  type="color"
                  value={c}
                  onChange={(e) => set({ colors: brief.colors.map((x, j) => (j === i ? e.target.value : x)) })}
                  aria-label={`Color ${i + 1}`}
                />
              </label>
              <button type="button" onClick={() => set({ colors: brief.colors.filter((_, j) => j !== i) })} aria-label="Remove color">
                ×
              </button>
            </span>
          ))}
          {brief.colors.length < 3 && (
            <button
              type="button"
              className="tb-add"
              onClick={() => set({ colors: [...brief.colors, ["#1b2a4a", "#f5b700", "#ffffff"][brief.colors.length]] })}
            >
              + Color
            </button>
          )}
        </div>
      </div>

      <div className="tb-row">
        <span className="tb-label">Include</span>
        <div className="tb-chips">
          {BRIEF_FIELDS.map(([id, label]) => (
            <button
              type="button"
              key={id}
              role="checkbox"
              aria-checked={id in brief.content}
              className={`tb-check ${id in brief.content ? "active" : ""}`}
              onClick={() => toggleField(id)}
            >
              <span aria-hidden="true">{id in brief.content ? "✓" : "+"}</span> {label}
            </button>
          ))}
        </div>
      </div>

      {/* the exact words for each chosen part; empty lets the AI write it */}
      {chosen.length > 0 && (
        <div className="tb-fields">
          {chosen.map(([id, label, example]) => (
            <label key={id}>
              <span>{label}</span>
              <input
                value={brief.content[id]}
                onChange={(e) => set({ content: { ...brief.content, [id]: e.target.value } })}
                placeholder={`Leave empty for AI, e.g. ${example}`}
                maxLength={300}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default TemplateBrief;
