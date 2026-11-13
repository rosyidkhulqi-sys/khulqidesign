import { useRef, useState } from "react";
import { Color, Gradient } from "fabric";
import { leaves, paletteOf } from "./colorTools";

const COLOR_GROUPS = [
  {
    name: "Brand kit",
    colors: [
      ["Brand red", "#f21d2b"], ["Black", "#000000"], ["White", "#ffffff"],
      ["Warm grey", "#8d939b"], ["Deep grey", "#25272a"], ["Paper", "#f4f1ea"],
    ],
  },
  {
    name: "Popular colors",
    colors: [
      ["Red", "#ef4444"], ["Orange", "#f97316"], ["Amber", "#f59e0b"],
      ["Yellow", "#facc15"], ["Green", "#22c55e"], ["Teal", "#14b8a6"],
      ["Cyan", "#06b6d4"], ["Blue", "#3b82f6"], ["Indigo", "#6366f1"],
      ["Purple", "#8b5cf6"], ["Pink", "#ec4899"], ["Brown", "#92400e"],
    ],
  },
];

const GRADIENTS = [
  ["Red to violet", "#f21d2b", "#7545e8"],
  ["Sunset", "#fb7185", "#f59e0b"],
  ["Ocean", "#06b6d4", "#3b82f6"],
  ["Mint", "#34d399", "#0f766e"],
  ["Berry", "#ec4899", "#7c3aed"],
  ["Night", "#334155", "#111827"],
];

const gradientDirections = {
  Horizontal: [0, 0.5, 1, 0.5],
  Vertical: [0.5, 0, 0.5, 1],
  Diagonal: [0, 0, 1, 1],
  "Reverse diagonal": [0, 1, 1, 0],
};

function parseColor(value) {
  try {
    const color = new Color(value || "#000000");
    const [r, g, b] = color.getSource();
    return {
      hex: `#${color.toHex().toLowerCase()}`,
      alpha: color.getAlpha(),
      rgb: [r, g, b].map((channel) => Math.round(channel)),
    };
  } catch {
    return { hex: "#000000", alpha: 1, rgb: [0, 0, 0] };
  }
}

const hexFromRgb = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, Number(v) || 0))).toString(16).padStart(2, "0")).join("")}`;

function hsvFromHex(hex) {
  const [r0, g0, b0] = parseColor(hex).rgb.map((v) => v / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r0) h = 60 * (((g0 - b0) / delta) % 6);
    else if (max === g0) h = 60 * ((b0 - r0) / delta + 2);
    else h = 60 * ((r0 - g0) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function hexFromHsv({ h, s, v }) {
  const chroma = v * s;
  const section = h / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const [r, g, b] = section < 1 ? [chroma, x, 0]
    : section < 2 ? [x, chroma, 0]
      : section < 3 ? [0, chroma, x]
        : section < 4 ? [0, x, chroma]
          : section < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  const m = v - chroma;
  return hexFromRgb([r, g, b].map((channel) => Math.round((channel + m) * 255)));
}

function asPaint(hex, alpha) {
  if (alpha >= 0.999) return hex;
  const [r, g, b] = parseColor(hex).rgb;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function targetsOf(object) {
  return leaves(object).flatMap((leaf) => ["fill", "stroke"].flatMap((prop) => {
    const value = leaf[prop];
    if (typeof value === "string" && value && value !== "none") return [[leaf, prop]];
    if (value instanceof Gradient) return [[leaf, prop]];
    return [];
  }));
}

function gradientOf(targets) {
  const target = targets?.find(([leaf, prop]) => leaf[prop] instanceof Gradient);
  return target ? target[0][target[1]] : null;
}

// Picks a color: anywhere on screen where the browser can (Chrome, Edge),
// otherwise from the page being designed (Safari, Firefox), via onPickFromPage.
function ColorActions({ targets, onChange, onPicked, onNoColor, onPickFromPage }) {
  const screenPicker = typeof window !== "undefined" && typeof window.EyeDropper === "function";
  const canPick = screenPicker || Boolean(onPickFromPage);
  const apply = (hex) => {
    targets.forEach(([leaf, prop]) => leaf.set(prop, hex));
    onPicked?.(hex);
    onChange?.();
  };
  const pick = async () => {
    if (!screenPicker) {
      onPickFromPage?.(apply);
      return;
    }
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      apply(sRGBHex);
    } catch {
      /* closed without picking */
    }
  };
  const clear = () => {
    targets.forEach(([leaf, prop]) => leaf.set(prop, "transparent"));
    onNoColor?.();
    onChange?.();
  };

  return (
    <>
      <button className="pp-color-tool" onClick={pick} disabled={!canPick || !targets.length} title={screenPicker ? "Pick color from screen" : canPick ? "Pick a color from the page" : "Color picker is not supported in this browser"} aria-label="Pick color from screen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m14.5 5.5 4 4-8.7 8.7-4.6 1 1-4.6z" />
          <path d="m13 7 4 4M16.5 3.5l2-2 4 4-2 2" />
        </svg>
      </button>
      <button className="pp-color-tool pp-color-tool-none" onClick={clear} disabled={!targets.length} title="No color" aria-label="Remove color">
        <span aria-hidden="true" />
      </button>
    </>
  );
}

function CreateColors({ object, onEdit, onChange, onPickFromPage }) {
  const entries = paletteOf(object);
  const allTargets = targetsOf(object);
  const gradient = gradientOf(allTargets);
  const colors = entries.slice(0, 6);
  const [activeColor, setActiveColor] = useState(entries[0]?.color ?? null);
  const selectedEntry = entries.find((entry) => entry.color === activeColor) ?? entries[0];
  const actionTargets = selectedEntry?.targets ?? allTargets;

  if (gradient && !colors.length) {
    const stopColors = gradient.colorStops.map((stop) => stop.color);
    return (
      <div className="pp-color-block">
        <div className="pp-color-heading"><p className="cp-label">Colors</p><button onClick={() => onEdit(stopColors[0] ?? "#000000")}>Edit color</button></div>
        <div className="pp-colors">
          <button className="pp-color-chip pp-color-gradient-chip" style={{ background: `linear-gradient(90deg, ${stopColors.join(", ")})` }} onClick={() => onEdit(stopColors[0] ?? "#000000")} aria-label="Edit gradient color" />
          <ColorActions targets={actionTargets} onChange={onChange} onPickFromPage={onPickFromPage} />
        </div>
      </div>
    );
  }
  if (!colors.length && !actionTargets.length) return null;
  return (
    <div className="pp-color-block">
      <div className="pp-color-heading">
        <p className="cp-label">Colors</p>
        <button onClick={() => onEdit(selectedEntry?.color ?? "#000000")}>Edit color</button>
      </div>
      <div className="pp-colors">
        {colors.map((entry) => (
          <button
            key={entry.color}
            className={`pp-color-chip ${entry.color === activeColor ? "is-active" : ""}`}
            style={{ backgroundColor: entry.color }}
            onClick={() => { setActiveColor(entry.color); onEdit(entry.color); }}
            title={`Edit ${entry.color}`}
            aria-label={`Edit color ${entry.color}`}
          />
        ))}
        <ColorActions
          targets={actionTargets}
          onChange={onChange}
          onPickFromPage={onPickFromPage}
          onPicked={(color) => setActiveColor(color)}
          onNoColor={() => setActiveColor(null)}
        />
      </div>
    </div>
  );
}

export function CreateColorPanel({ object, initialColor = "#000000", mode = "object", onBackgroundChange, onChange, onClose }) {
  const initialEntries = object ? paletteOf(object) : [];
  const initialEntry = initialEntries.find((entry) => entry.color === initialColor) ?? initialEntries[0];
  const initialTargets = initialEntry?.targets ?? (object ? targetsOf(object) : []);
  const initialGradient = gradientOf(initialTargets);
  const initialPaint = initialGradient?.colorStops[0]?.color ?? initialEntry?.color ?? initialColor;
  const initial = parseColor(initialPaint);
  const initialStops = initialGradient?.colorStops?.length > 1
    ? [...initialGradient.colorStops].sort((a, b) => a.offset - b.offset).map((stop) => stop.color)
    : [initial.hex, "#7545e8"];
  const [tab, setTab] = useState(initialGradient ? "gradient" : "solid");
  const [hex, setHex] = useState(initial.hex);
  const [alpha, setAlpha] = useState(initialGradient?.colorStops[0]?.opacity ?? initial.alpha);
  const [hsv, setHsv] = useState(() => hsvFromHex(initial.hex));
  const [search, setSearch] = useState("");
  const [gradientStops, setGradientStops] = useState([initialStops[0], initialStops[initialStops.length - 1]]);
  const [activeStop, setActiveStop] = useState(0);
  const [gradientDirection, setGradientDirection] = useState("Horizontal");
  const targetRef = useRef(initialTargets);

  const entries = object ? paletteOf(object) : [];
  const filteredColors = COLOR_GROUPS.flatMap((group) => group.colors)
    .filter(([name, color]) => !search || `${name} ${color}`.toLowerCase().includes(search.trim().toLowerCase()));

  const setSelectedColor = (color, nextAlpha = 1, apply = true) => {
    const parsed = parseColor(color);
    setHex(parsed.hex);
    setAlpha(nextAlpha);
    setHsv(hsvFromHex(parsed.hex));
    if (tab === "gradient") {
      const nextStops = gradientStops.map((stop, index) => index === activeStop ? parsed.hex : stop);
      setGradientStops(nextStops);
      if (apply) applyGradient(nextStops, gradientDirection, nextAlpha);
    } else if (apply) applySolid(parsed.hex, nextAlpha);
  };

  const currentEntry = entries.find((entry) => entry.color === initialColor) ?? entries[0];
  const getTargets = () => targetRef.current?.length ? targetRef.current : currentEntry?.targets ?? [];

  function applySolid(color, opacity = 1) {
    if (mode === "background") {
      onBackgroundChange?.(asPaint(color, opacity), color);
      return;
    }
    const targets = getTargets();
    targets.forEach(([leaf, prop]) => leaf.set(prop, asPaint(color, opacity)));
    onChange?.();
  }

  function applyGradient(stops, direction = gradientDirection, stopAlpha = 1) {
    const targets = getTargets();
    const coords = gradientDirections[direction] ?? gradientDirections.Horizontal;
    const gradient = new Gradient({
      type: "linear",
      gradientUnits: "percentage",
      coords: { x1: coords[0], y1: coords[1], x2: coords[2], y2: coords[3] },
      colorStops: [
        { offset: 0, color: stops[0], opacity: activeStop === 0 ? stopAlpha : 1 },
        { offset: 1, color: stops[1], opacity: activeStop === 1 ? stopAlpha : 1 },
      ],
    });
    if (mode === "background") {
      onBackgroundChange?.(gradient, stops[0]);
      return;
    }
    targets.forEach(([leaf, prop]) => leaf.set(prop, gradient));
    onChange?.();
  }

  const chooseColor = (color) => {
    const entry = entries.find((candidate) => candidate.color === color);
    if (entry) targetRef.current = entry.targets;
    setSelectedColor(color, parseColor(color).alpha);
  };

  const updateHsv = (next) => setSelectedColor(hexFromHsv(next), alpha);
  const updateRgb = (index, value) => {
    const rgb = parseColor(hex).rgb;
    rgb[index] = Math.max(0, Math.min(255, Number(value) || 0));
    setSelectedColor(hexFromRgb(rgb), alpha);
  };

  const chooseGradient = (start, end) => {
    const next = [start, end];
    setGradientStops(next);
    setActiveStop(0);
    setHex(start);
    setAlpha(1);
    setHsv(hsvFromHex(start));
    applyGradient(next, gradientDirection, 1);
  };

  const onSvPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = {
      ...hsv,
      s: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      v: Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)),
    };
    updateHsv(next);
  };

  const onSvKeyDown = (event) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const next = { ...hsv };
    if (event.key === "ArrowLeft") next.s -= step;
    else if (event.key === "ArrowRight") next.s += step;
    else if (event.key === "ArrowUp") next.v += step;
    else if (event.key === "ArrowDown") next.v -= step;
    else return;
    event.preventDefault();
    updateHsv({ ...next, s: Math.max(0, Math.min(1, next.s)), v: Math.max(0, Math.min(1, next.v)) });
  };

  return (
    <div className="cp-color-editor">
      <header className="cp-color-head">
        <div>
          <h2>{mode === "background" ? "Background color" : "Color"}</h2>
          <p>{mode === "background" ? "Choose a page background" : "Edit the selected element"}</p>
        </div>
        <button className="cp-color-close" onClick={onClose} title="Close color panel" aria-label="Close color panel">×</button>
      </header>

      <label className="cp-color-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a color or enter HEX" />
      </label>

      {mode === "object" && entries.length > 0 && (
        <section className="cp-color-section">
          <p className="cp-label">Element colors</p>
          <div className="cp-color-chips">
            {entries.slice(0, 8).map((entry) => (
              <button
                key={entry.color}
                className={`cp-color-chip ${entry.color === hex ? "is-active" : ""}`}
                style={{ backgroundColor: entry.color }}
                onClick={() => chooseColor(entry.color)}
                title={entry.color}
                aria-label={`Select ${entry.color}`}
              />
            ))}
          </div>
        </section>
      )}

      <div className="cp-color-tabs" role="tablist" aria-label="Color type">
        <button role="tab" aria-selected={tab === "solid"} className={tab === "solid" ? "is-active" : ""} onClick={() => { if (tab === "gradient") applySolid(hex, alpha); setTab("solid"); }}>Solid color</button>
        <button
          role="tab"
          aria-selected={tab === "gradient"}
          className={tab === "gradient" ? "is-active" : ""}
          onClick={() => {
            setTab("gradient");
            applyGradient(gradientStops, gradientDirection, alpha);
          }}
        >Gradient</button>
      </div>

      {tab === "gradient" && (
        <section className="cp-color-section">
          <div className="cp-color-section-title"><p className="cp-label">Gradient colors</p><select value={gradientDirection} onChange={(event) => { setGradientDirection(event.target.value); applyGradient(gradientStops, event.target.value, alpha); }} aria-label="Gradient direction">{Object.keys(gradientDirections).map((direction) => <option key={direction}>{direction}</option>)}</select></div>
          <div className="cp-gradient-stops">
            {gradientStops.map((stop, index) => (
              <button key={index} className={activeStop === index ? "is-active" : ""} onClick={() => { setActiveStop(index); setSelectedColor(stop, 1, false); }}>
                <span style={{ backgroundColor: stop }} />{index === 0 ? "Start" : "End"}
              </button>
            ))}
          </div>
          <div className="cp-gradient-presets">
            {GRADIENTS.map(([name, start, end]) => (
              <button key={name} title={name} aria-label={name} style={{ background: `linear-gradient(105deg, ${start}, ${end})` }} onClick={() => chooseGradient(start, end)} />
            ))}
          </div>
        </section>
      )}

      <section className="cp-color-section cp-custom-color">
        <p className="cp-label">{tab === "gradient" ? `Edit ${activeStop === 0 ? "start" : "end"} color` : "Color picker"}</p>
        <div
          className="cp-color-sv"
          style={{ "--picker-hue": `hsl(${hsv.h} 100% 50%)`, "--picker-x": `${hsv.s * 100}%`, "--picker-y": `${(1 - hsv.v) * 100}%` }}
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onSvPointer(event); }}
          onPointerMove={(event) => { if (event.buttons) onSvPointer(event); }}
          onKeyDown={onSvKeyDown}
          tabIndex={0}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv.s * 100)}
          aria-label="Saturation and brightness picker"
        >
          <i />
        </div>
        <label className="cp-hue-control"><span>Hue</span><input type="range" min="0" max="359" value={Math.round(hsv.h)} onChange={(event) => updateHsv({ ...hsv, h: Number(event.target.value) })} aria-label="Hue" /></label>
        <div className="cp-color-fields">
          <label className="cp-hex-field"><span>HEX</span><input value={hex.toUpperCase()} onChange={(event) => { const value = event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`; setHex(value); if (/^#[0-9a-f]{6}$/i.test(value)) setSelectedColor(value, alpha); }} onBlur={() => { if (!/^#[0-9a-f]{6}$/i.test(hex)) setHex(parseColor(hex).hex); }} maxLength="7" /></label>
          {parseColor(hex).rgb.map((value, index) => (
            <label className="cp-rgb-field" key={index}><span>{["R", "G", "B"][index]}</span><input type="number" min="0" max="255" value={value} onChange={(event) => updateRgb(index, event.target.value)} /></label>
          ))}
        </div>
        <label className="cp-alpha-field"><span>Color opacity</span><input type="range" min="0" max="100" value={Math.round(alpha * 100)} onChange={(event) => setSelectedColor(hex, Number(event.target.value) / 100)} /><output>{Math.round(alpha * 100)}%</output></label>
      </section>

      <section className="cp-color-section cp-preset-list">
        {COLOR_GROUPS.map((group) => {
          const colors = group.colors.filter(([name, color]) => !search || `${name} ${color}`.toLowerCase().includes(search.trim().toLowerCase()));
          if (!colors.length) return null;
          return (
            <div key={group.name}>
              <p className="cp-label">{group.name}</p>
              <div className="cp-preset-swatches">
                {colors.map(([name, color]) => <button key={color} style={{ backgroundColor: color }} title={`${name} · ${color}`} aria-label={`${name}, ${color}`} onClick={() => chooseColor(color)} />)}
              </div>
            </div>
          );
        })}
        {search && /^#?(?:[0-9a-f]{6}|[0-9a-f]{3})$/i.test(search.trim()) && (
          <button className="cp-apply-hex" onClick={() => chooseColor(search.trim().startsWith("#") ? search.trim() : `#${search.trim()}`)}>Use {search.startsWith("#") ? search : `#${search}`}</button>
        )}
        {filteredColors.length === 0 && !/^#?(?:[0-9a-f]{6}|[0-9a-f]{3})$/i.test(search.trim()) && <p className="cp-hint">No matching color. Try a color name or HEX value.</p>}
      </section>
    </div>
  );
}

export default CreateColors;
