// Animate an icon: pick an icon from the library and a motion preset, and
// watch it play. Presets are plain CSS, so this works without AI or a server.
// Anyone can try it; exporting asks for an account. Every export is built here
// in the browser (lib/animateExport.js, lib/animateLottie.js).
import { useEffect, useRef, useState } from "react";
import "./AnimateIcon.css";
import { fileSlug, loadIconSvg } from "../../lib/iconEditor";
import { fetchIconCatalog } from "../../lib/catalog";
import { buildAnimatedSvg, buildGif, buildMp4 } from "../../lib/animateExport";
import { saveBlob } from "../../lib/downloads";
import { askLogin } from "../../lib/authGate";
import { keepAnimate, takeAnimate } from "../../lib/aiKeep";
import { PremiumPrompt, PremiumTag } from "../../components/IconControls";
import { fetchMembership } from "../../lib/billing";

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
const canDraw = (icon) => icon?.style === "outline" || icon?.style === "glyph";

const DRAWABLE ="path, circle, rect, ellipse, line, polyline, polygon";

const speeds = [
  [0.5, "0.5×"],
  [1, "1×"],
  [2, "2×"],
];

// seconds for one play at 1×
const BASE = 1.2;

// formats only Premium members can export; GIF and MP4 stay free
const PREMIUM_EXPORTS = ["svg", "json"];

function AnimateIcon({ initialIcon = null, user = null, setPage }) {
  // back from logging in to export: what the visitor had chosen
  const [kept] = useState(takeAnimate);
  const opening = initialIcon ?? kept?.icon ?? null;
  const [list, setList] = useState(() => opening ? [opening] : []);
  const [icon, setIcon] = useState(opening);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [preset, setPreset] = useState(kept?.preset ?? "bounce");
  const [speed, setSpeed] = useState(kept?.speed ?? 1);
  const [loop, setLoop] = useState(kept?.loop ?? true);
  // changing the key restarts the animation (Replay)
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [svg, setSvg] = useState(null);
  const [membership, setMembership] = useState(null);
  // the "this export is Premium" note is open
  const [upsell, setUpsell] = useState(false);
  const stage = useRef(null);
  // the export being made: { kind, progress }, or null
  const [making, setMaking] = useState(null);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchIconCatalog()
      .then(({ icons: uploaded }) => {
        if (!alive) return;
        const nextList = opening && !uploaded.some((item) => item.image === opening.image)
          ? [opening, ...uploaded]
          : uploaded;
        setList(nextList);
        setIcon((current) => nextList.find((item) => item.image === current?.image) ?? nextList[0] ?? null);
        setCatalogError(null);
      })
      .catch((error) => alive && setCatalogError(error.message || "Icons could not be loaded."))
      .finally(() => alive && setCatalogLoading(false));
    return () => { alive = false; };
  }, [opening]);

  // the icon's SVG, cleaned, so its parts can move one by one
  useEffect(() => {
    if (!icon?.image) return;
    let alive = true;
    loadIconSvg(icon.image)
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    return () => {
      alive = false;
    };
  }, [icon?.image]);

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

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchMembership(user.id).then((m) => alive && setMembership(m));
    return () => {
      alive = false;
    };
  }, [user]);

  const exportAs = async (kind) => {
    if (!icon) return;
    if (!user) {
      keepAnimate({ icon, preset, speed, loop });
      askLogin("download");
      return;
    }
    if (PREMIUM_EXPORTS.includes(kind) && !membership?.canUsePremium) {
      setUpsell(true);
      return;
    }
    const iconEl = stage.current?.querySelector("svg.animate-icon");
    if (!iconEl || making) return;
    const options = { preset, duration, loop };
    const name = `${fileSlug(icon.name)}-${preset}`;
    setExportError(null);

    if (kind === "svg") {
      const file = buildAnimatedSvg(iconEl, options);
      saveBlob(new Blob([file], { type: "image/svg+xml" }), `${name}.svg`);
      return;
    }

    if (kind === "json") {
      try {
        // the converter loads only when someone asks for a Lottie file
        const { buildLottie } = await import("../../lib/animateLottie");
        const file = buildLottie(svg, { preset, duration, name: icon.name });
        saveBlob(new Blob([file], { type: "application/json" }), `${name}.json`);
      } catch (e) {
        setExportError(e.message || "This export didn't work. Try again.");
      }
      return;
    }

    setMaking({ kind, progress: 0 });
    try {
      const build = kind === "gif" ? buildGif : buildMp4;
      const blob = await build(iconEl, options, (progress) => setMaking({ kind, progress }));
      saveBlob(blob, `${name}.${kind}`);
    } catch (e) {
      setExportError(e.message || "This export didn't work. Try again.");
    } finally {
      setMaking(null);
    }
  };

  const exportLabel = (kind, label) =>
    making?.kind === kind ? `${Math.round(making.progress * 100)}%` : label;

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
          aria-label={icon ? `${icon.name} icon, ${preset} animation` : "Icon animation preview"}
          role="img"
        >
          {svg ? (
            // our own icon files, cleaned by loadIconSvg (no scripts or handlers)
            <svg
              className="animate-icon"
              viewBox={svg.viewBox}
              dangerouslySetInnerHTML={{ __html: svg.inner }}
            />
          ) : icon ? (
            <img className="animate-icon" src={icon.image} alt="" />
          ) : <span className="animate-empty">{catalogLoading ? "Loading icons…" : "No published icons yet."}</span>}
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
              className={i.image === icon?.image ? "active" : ""}
              onClick={() => {
                // Draw isn't offered for flat and gradient icons
                if (preset === "draw" && !canDraw(i)) setPreset("bounce");
                pick(setIcon)(i);
              }}
              title={i.name}
              aria-label={i.name}
              aria-pressed={i.image === icon?.image}
            >
              <img src={i.image} alt="" />
            </button>
          ))}
        </div>
        {catalogError && <p className="animate-error" role="alert">{catalogError}</p>}

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
          <button className="is-ready" onClick={() => exportAs("gif")} disabled={!svg || Boolean(making)}>
            {exportLabel("gif", "GIF")}
          </button>
          <button className="is-ready" onClick={() => exportAs("mp4")} disabled={!svg || Boolean(making)}>
            {exportLabel("mp4", "MP4")}
          </button>
          <button className="is-ready" onClick={() => exportAs("svg")} disabled={!svg || Boolean(making)}>
            Animated SVG<PremiumTag />
          </button>
          <button className="is-ready" onClick={() => exportAs("json")} disabled={!svg || Boolean(making)}>
            Lottie JSON<PremiumTag />
          </button>
        </div>
        {exportError && <p className="animate-error" role="alert">{exportError}</p>}
        {upsell && (
          <PremiumPrompt
            signedIn
            title="Animated SVG and Lottie are Premium"
            text="GIF and MP4 stay free. Go Premium to export animated SVG and Lottie files for websites and apps."
            onAuth={(page) => setPage?.(page)}
            onDismiss={() => setUpsell(false)}
          />
        )}
        <p className="animate-note">
          GIF and MP4 have a white background.
        </p>
      </div>
    </div>
  );
}

export default AnimateIcon;
