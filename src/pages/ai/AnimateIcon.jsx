// Animate an icon: pick an icon from the library and a motion preset, and
// watch it play. Presets are plain CSS, so this works now, without AI or a
// server. Exporting the motion as Lottie, GIF or MP4 needs the backend.
import { useEffect, useRef, useState } from "react";
import "./AnimateIcon.css";
import { iconSets, membersOf } from "../../data/iconsData";
import { loadIconSvg } from "../../lib/iconEditor";

// one entry per real icon file, in set order
const icons = iconSets.flatMap((set) => membersOf(set));

const presets = [
  ["bounce", "Bounce"],
  ["pop", "Pop"],
  ["spin", "Spin"],
  ["shake", "Shake"],
  ["pulse", "Pulse"],
  ["float", "Float"],
  ["swing", "Swing"],
  // the icon's parts appear one after another; best for flat icons
  ["build", "Build"],
  // the outline is traced like a pen drawing, then the color fills in
  ["draw", "Draw"],
];

// Draw suits one-color line and solid icons; on flat and gradient icons the
// traced edges of many colored parts look messy, so it isn't offered there
const canDraw = (icon) => icon.style === "outline" || icon.style === "glyph";

const DRAWABLE ="path, circle, rect, ellipse, line, polyline, polygon";

const speeds = [
  [0.5, "0.5×"],
  [1, "1×"],
  [2, "2×"],
];

// seconds for one play at 1×
const BASE = 1.2;

// opened from an icon's detail view: that icon is selected, and if it isn't
// in a set it goes first in the picker
function startList(initial) {
  if (!initial || icons.some((i) => i.image === initial.image)) return icons;
  return [initial, ...icons];
}

function AnimateIcon({ initialIcon = null }) {
  const [list] = useState(() => startList(initialIcon));
  const [icon, setIcon] = useState(
    () => list.find((i) => i.image === initialIcon?.image) ?? list[0]
  );
  const [preset, setPreset] = useState("bounce");
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  // changing the key restarts the animation (Replay)
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [svg, setSvg] = useState(null);
  const stage = useRef(null);

  // the icon's SVG, cleaned, so its parts can move one by one
  useEffect(() => {
    let alive = true;
    loadIconSvg(icon.image)
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    return () => {
      alive = false;
    };
  }, [icon.image]);

  const duration = BASE / speed;

  // Build: each part waits a little longer than the one before. Illustrator
  // often wraps a whole icon in one <g>, so step inside single wrappers to
  // reach the shapes the icon is made of.
  // Draw: every shape gets a dashed stroke as long as its outline, and the
  // dash slides away (a pen tracing it). Our outline icons are exported as
  // filled shapes, so shapes without a stroke borrow their fill color for the
  // trace, which fades once the fill is in. The stage remounts on every
  // change (key={run}), so the markup starts clean each time.
  useEffect(() => {
    const svgEl = stage.current?.querySelector("svg");
    if (!svgEl || preset !== "draw") return;
    const vb = svgEl.viewBox.baseVal;
    const width = Math.max(vb?.width || 512, vb?.height || 512) / 160;
    const shapes = [...svgEl.querySelectorAll(DRAWABLE)].filter((el) => !el.closest("defs, clipPath, mask"));
    const step = (duration * 0.4) / Math.max(1, shapes.length);
    shapes.forEach((el, i) => {
      let len;
      try {
        len = el.getTotalLength();
      } catch {
        return;
      }
      if (!len) return;
      const cs = getComputedStyle(el);
      if (cs.stroke === "none") {
        el.style.stroke = cs.fill === "none" ? "currentColor" : cs.fill;
        el.style.strokeWidth = width;
        el.classList.add("kd-trace");
      }
      el.classList.add("kd-draw");
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
      el.style.animationDelay = `${i * step}s`;
    });
  }, [svg, preset, duration, run]);

  useEffect(() => {
    let root = stage.current?.querySelector("svg");
    if (!root) return;
    while (root.children.length === 1 && root.firstElementChild.tagName.toLowerCase() === "g") {
      root = root.firstElementChild;
    }
    const parts = [...root.children].filter((el) => !/^(defs|lineargradient|radialgradient|style)$/i.test(el.tagName));
    const step = (duration * 0.6) / Math.max(1, parts.length);
    parts.forEach((part, i) => {
      part.classList.toggle("kd-part", preset === "build");
      part.style.animationDelay = preset === "build" ? `${i * step}s` : "";
    });
  }, [svg, preset, duration, run]);

  const pick = (setter) => (value) => {
    setter(value);
    setPlaying(true);
    setRun((r) => r + 1);
  };

  return (
    <div className="animate">
      {/* a square artboard on a dotted workspace, as in Lottie and motion editors */}
      <div className="animate-workspace">
        <div
          key={run}
          ref={stage}
          className={`animate-stage is-${preset} ${loop ? "loop" : "once"}${playing ? "" : " paused"}`}
          style={{ "--dur": `${duration}s` }}
          aria-label={`${icon.name} icon, ${preset} animation`}
          role="img"
        >
          {svg ? (
            // our own icon files, cleaned by loadIconSvg (no scripts or handlers)
            <svg
              className="animate-icon"
              viewBox={svg.viewBox}
              dangerouslySetInnerHTML={{ __html: svg.inner }}
            />
          ) : (
            <img className="animate-icon" src={icon.image} alt="" />
          )}
        </div>
        <div className="animate-bar">
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause" : "Play"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5l11 7-11 7z" />}
            </svg>
          </button>
          <button
            onClick={() => {
              setPlaying(true);
              setRun((r) => r + 1);
            }}
            aria-label="Replay"
            title="Replay"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4" />
            </svg>
          </button>
          <span className="animate-bar-info">
            512 × 512 · {duration.toFixed(1)} s · {loop ? "Loop" : "Once"}
          </span>
        </div>
      </div>

      <div className="animate-panel">
        <p className="animate-label">Icon</p>
        <div className="animate-icons">
          {list.map((i) => (
            <button
              key={i.image}
              className={i.image === icon.image ? "active" : ""}
              onClick={() => {
                // Draw isn't offered for flat and gradient icons
                if (preset === "draw" && !canDraw(i)) setPreset("bounce");
                pick(setIcon)(i);
              }}
              title={i.name}
              aria-label={i.name}
              aria-pressed={i.image === icon.image}
            >
              <img src={i.image} alt="" />
            </button>
          ))}
        </div>

        <p className="animate-label">Motion</p>
        <div className="animate-chips">
          {presets.filter(([id]) => id !== "draw" || canDraw(icon)).map(([id, label]) => (
            <button
              key={id}
              className={preset === id ? "active" : ""}
              onClick={() => pick(setPreset)(id)}
              aria-pressed={preset === id}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="animate-label">Speed</p>
        <div className="animate-chips">
          {speeds.map(([value, label]) => (
            <button
              key={value}
              className={speed === value ? "active" : ""}
              onClick={() => pick(setSpeed)(value)}
              aria-pressed={speed === value}
            >
              {label}
            </button>
          ))}
          <label className="animate-loop">
            <input type="checkbox" checked={loop} onChange={(e) => pick(setLoop)(e.target.checked)} />
            Loop
          </label>
        </div>

        <p className="animate-label">Export</p>
        <div className="animate-export">
          {["Lottie JSON", "GIF", "MP4"].map((f) => (
            <button key={f} disabled>
              {f}
            </button>
          ))}
        </div>
        <p className="animate-note">
          <span className="ai-soon">Coming soon</span>
          Exports are rendered on our server once it's live.
        </p>
      </div>
    </div>
  );
}

export default AnimateIcon;
