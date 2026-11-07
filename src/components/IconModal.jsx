import { useEffect, useRef, useState } from "react";
import { saveBlob, saveDownload } from "../lib/downloads";
import {
  buildIconSvg,
  canRecolor as recolorable,
  defaultEdits,
  fileSlug as slug,
  iconColors as colors,
  loadIconSvg,
  svgDataUrl,
  svgToPng,
} from "../lib/iconEditor";
import { PremiumPrompt, PremiumTag, SizePicker, Swatches, ToolGlyph } from "./IconControls";
import "./AssetModal.css";
import "./IconModal.css";

const bgColors = ["#e4e4e7", "#000000", "#f0202d", "#2563eb", "#fde68a"];
const shapes = [
  ["none", "No background"],
  ["circle", "Circle"],
  ["square", "Square"],
  ["rounded", "Rounded square"],
];

// flat icons: every color in the file, click one to replace it everywhere
function Palette({ colors, palette, onChange }) {
  return (
    <div className="ie-swatches">
      {colors.map((original) => {
        const value = palette[original] ?? original;
        return (
          <label
            key={original}
            className={`ie-chip ${palette[original] ? "changed" : ""}`}
            style={{ background: value }}
            title={`Replace ${original.toUpperCase()}`}
          >
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(original, e.target.value)}
              aria-label={`Replace color ${original}`}
            />
          </label>
        );
      })}
    </div>
  );
}

function IconModal({
  icon,
  initialEdits = null,
  initialSize = 512,
  set: iconSet = null,
  setMembers = [],
  onOpenSet,
  related = [],
  user = null,
  onAuth,
  onSelect,
  onTag,
  onClose,
}) {
  const [source, setSource] = useState(null);
  const [failed, setFailed] = useState(false);
  // opened from a set page, the icon starts with the set's color
  const [edits, setEdits] = useState(() => ({ ...defaultEdits, ...initialEdits }));
  const [px, setPx] = useState(initialSize);
  const [liked, setLiked] = useState(false);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(null);
  // which Premium action a signed-out visitor tried: "svg" or "png"
  const [prompt, setPrompt] = useState(null);
  const copyTimer = useRef(null);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    loadIconSvg(icon.image)
      .then((svg) => alive && setSource(svg))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [icon.image]);

  const premium = icon.license === "premium";
  const canRecolor = recolorable(icon.style);
  const flatColors = icon.style === "flat" ? source?.colors ?? [] : [];
  const finalEdits = canRecolor
    ? { ...edits, palette: {} }
    : { ...edits, color: null, palette: flatColors.length ? edits.palette : {} };
  const edited = JSON.stringify(edits) !== JSON.stringify(defaultEdits);

  const set = (patch) => setEdits((e) => ({ ...e, ...patch }));
  const pickShape = (shape) =>
    // a background needs room around the icon, so shrink it on first use
    set(edits.shape === "none" && shape !== "none" && edits.scale === 100
      ? { shape, scale: 60 }
      : { shape });

  const preview = source ? svgDataUrl(buildIconSvg(source, finalEdits)) : icon.image;
  const fileName = `${icon.code}-${slug(icon.name)}`;

  const record = (format) =>
    saveDownload({
      id: icon.code,
      title: icon.name,
      kind: "icon",
      image: icon.image,
      file: icon.image,
      format,
      license: premium ? "standard" : "free",
      date: new Date().toISOString(),
    });

  // Premium preview: signed-out visitors see an invitation instead of the file.
  // Signed-in users can still download until subscriptions exist; the real
  // check moves to the server with the backend.
  const needsPremium = (format) => premium || format === "svg";
  const gate = (format, action) => {
    if (!user && needsPremium(format)) {
      setPrompt(format);
      return;
    }
    setPrompt(null);
    action(format);
  };

  // shows "Copied" for a moment; a new copy restarts the timer
  const flash = (state, ms) => {
    clearTimeout(copyTimer.current);
    setCopied(state);
    copyTimer.current = setTimeout(() => setCopied(null), ms);
  };

  // paste straight into Figma (SVG stays an editable vector), Canva, Slides...
  const copy = async (format) => {
    if (!source) return;
    try {
      if (format === "svg") {
        await navigator.clipboard.writeText(buildIconSvg(source, finalEdits, px));
      } else {
        // Safari needs the clipboard item created right away, with the PNG as a promise
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": svgToPng(buildIconSvg(source, finalEdits, px), px) }),
        ]);
      }
      record(`${format.toUpperCase()} ${px}px (copied)`);
      flash(format, 1800);
    } catch {
      flash("error", 2400);
    }
  };

  const download = async (format) => {
    if (!source) return;
    // the SVG stays a vector; its size is what design tools use when it's placed
    const svg = buildIconSvg(source, finalEdits, px);
    const file = format === "svg"
      ? new Blob([svg], { type: "image/svg+xml" })
      : await svgToPng(svg, px);
    saveBlob(file, `${fileName}-${px}px.${format}`);
    record(`${format.toUpperCase()} ${px}px`);
  };

  const share = async () => {
    const data = { title: `${icon.name} icon · Khulqidesign`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      /* share cancelled */
    }
  };

  return (
    <div className="asset-overlay" onClick={onClose}>
      <div
        className="asset-modal icon-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${icon.name} icon`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="asset-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="asset-body icon-body">
          {/* PREVIEW + CUSTOMIZE */}
          <div className="asset-left">
            <div className="ie-stage">
              <img src={preview} alt={icon.name} />
            </div>

            <div className="ie-panel">
              <div className="ie-panel-head">
                <p className="asset-label">Customize this icon</p>
                <button className="ie-reset" onClick={() => setEdits(defaultEdits)} disabled={!edited}>
                  ⟲ Reset
                </button>
              </div>

              {failed && <p className="ie-note">This icon can't be edited right now.</p>}

              <div className="ie-row">
                <span className="ie-name">Color</span>
                {canRecolor ? (
                  <Swatches list={colors} value={edits.color} label="Icon color"
                            onChange={(color) => set({ color })} />
                ) : flatColors.length > 0 ? (
                  <Palette colors={flatColors} palette={edits.palette}
                           onChange={(from, to) => set({ palette: { ...edits.palette, [from]: to } })} />
                ) : (
                  <span className="ie-note">
                    {icon.style === "gradient" ? "Gradient icon" : "This icon"}: colors are fixed.
                  </span>
                )}
              </div>

              <div className="ie-row">
                <span className="ie-name">Transform</span>
                <div className="ie-tools">
                  <button onClick={() => set({ rotate: edits.rotate - 15 })} title="Rotate left 15°" aria-label="Rotate left 15 degrees">
                    <ToolGlyph name="rotateLeft" />
                  </button>
                  <button onClick={() => set({ rotate: edits.rotate + 15 })} title="Rotate right 15°" aria-label="Rotate right 15 degrees">
                    <ToolGlyph name="rotateRight" />
                  </button>
                  <button className={edits.flipX ? "active" : ""} onClick={() => set({ flipX: !edits.flipX })}
                          title="Flip horizontal" aria-label="Flip horizontal" aria-pressed={edits.flipX}>
                    <ToolGlyph name="flipX" />
                  </button>
                  <button className={edits.flipY ? "active" : ""} onClick={() => set({ flipY: !edits.flipY })}
                          title="Flip vertical" aria-label="Flip vertical" aria-pressed={edits.flipY}>
                    <ToolGlyph name="flipY" />
                  </button>
                  <span className="ie-value">{((edits.rotate % 360) + 360) % 360}°</span>
                </div>
              </div>

              <div className="ie-row">
                <span className="ie-name">Background</span>
                <div className="ie-tools">
                  {shapes.map(([key, label]) => (
                    <button key={key} className={`ie-shape ${edits.shape === key ? "active" : ""}`}
                            onClick={() => pickShape(key)} title={label} aria-label={label}
                            aria-pressed={edits.shape === key}>
                      <i className={`shape-${key}`} />
                    </button>
                  ))}
                </div>
              </div>

              {edits.shape !== "none" && (
                <div className="ie-row">
                  <span className="ie-name">Fill</span>
                  <Swatches list={bgColors} value={edits.bgColor} label="Background color"
                            onChange={(bgColor) => set({ bgColor })} />
                </div>
              )}

              <div className="ie-row">
                <span className="ie-name">Size</span>
                <div className="ie-tools ie-size">
                  <input type="range" min="40" max="100" step="5" value={edits.scale}
                         onChange={(e) => set({ scale: Number(e.target.value) })} aria-label="Icon size" />
                  <span className="ie-value">{edits.scale}%</span>
                </div>
              </div>
            </div>

            <div className="asset-keywords">
              <p>Tags</p>
              <div>
                {icon.keywords.map((k) => (
                  <button key={k} onClick={() => onTag(k)}>{k}</button>
                ))}
              </div>
            </div>
          </div>

          {/* DETAILS + DOWNLOAD */}
          <div className="asset-right">
            <span className={`asset-license ${icon.license}`}>
              {premium ? "Premium" : "Free"} icon
            </span>
            <h2>{icon.name}</h2>
            <p className="asset-meta">
              ID {icon.code} · by <strong>Khulqidesign</strong>
            </p>

            {/* one size for every button below */}
            <p className="asset-label">Size</p>
            <SizePicker value={px} onChange={setPx} />

            {/* PNG is free on free icons; SVG and vector copy are always Premium.
                The lock itself comes with the backend; for now the tag marks it. */}
            <div className="ie-download">
              <button className="ie-png" onClick={() => gate("png", download)} disabled={!source}>
                ⬇ PNG{premium && <PremiumTag />}
              </button>
              <button className="ie-svg" onClick={() => gate("svg", download)} disabled={!source}>
                ⬇ SVG<PremiumTag />
              </button>
            </div>
            <div className="ie-copy">
              <button onClick={() => gate("svg", copy)} disabled={!source}>
                {copied === "svg" ? "✓ Copied" : <>Copy SVG<PremiumTag /></>}
              </button>
              <button onClick={() => gate("png", copy)} disabled={!source}>
                {copied === "png" ? "✓ Copied" : <>Copy PNG{premium && <PremiumTag />}</>}
              </button>
            </div>

            {prompt ? (
              <PremiumPrompt
                title={premium ? "This is a Premium icon" : "SVG is part of Premium"}
                text={premium
                  ? "Premium icons come with a subscription: every format, no attribution."
                  : "Get editable vectors for Figma and Illustrator. PNG stays free."}
                onAuth={onAuth}
                onDismiss={() => setPrompt(null)}
              />
            ) : (
              <p className="ie-premium">
                {premium
                  ? "This icon is included with Premium, in every format."
                  : "PNG is free. SVG and vector copy are included with Premium."}
              </p>
            )}
            <p className="ie-hint" role="status">
              {copied === "error"
                ? "Your browser blocked the clipboard. Use Download instead."
                : copied
                  ? "Paste it into Figma, Canva or Slides."
                  : edited
                    ? "Downloads and copies include your edits."
                    : ""}
            </p>

            <div className="ie-actions">
              <button className={liked ? "liked" : ""} onClick={() => setLiked(!liked)} aria-pressed={liked}>
                {liked ? "♥" : "♡"} {liked ? "Saved" : "Save"}
              </button>
              <button onClick={share}>↗ {shared ? "Link copied" : "Share"}</button>
            </div>

            {premium ? (
              <p className="asset-note">
                <em>Premium license.</em> Included with a Khulqidesign subscription.
                Commercial use, no attribution required.
              </p>
            ) : (
              <p className="asset-note">
                Free for personal & commercial use. Attribution required:
                <em> "Icon by Khulqidesign"</em>
              </p>
            )}

            <table className="asset-specs">
              <tbody>
                <tr><th>Icon ID</th><td>{icon.code}</td></tr>
                <tr><th>Style</th><td className="ie-cap">{icon.style}</td></tr>
                <tr><th>Category</th><td className="ie-cap">{icon.category}</td></tr>
                <tr><th>Formats</th><td>SVG, PNG · 16–512 px</td></tr>
                <tr><th>Canvas</th><td>512 × 512 px</td></tr>
                <tr>
                  <th>Icon set</th>
                  <td>
                    {iconSet ? (
                      <button className="ie-link" onClick={() => onOpenSet(iconSet)}>{iconSet.name}</button>
                    ) : (
                      "Single icon"
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FROM ICON SET — the icon's group, each one opens on its own */}
        {iconSet && setMembers.length > 1 && (
          <div className="asset-related">
            <div className="ie-set-head">
              <p className="asset-label">
                From icon set: <span>{iconSet.name}</span>
              </p>
              <button className="ie-link" onClick={() => onOpenSet(iconSet)}>
                View all {setMembers.length} icons ›
              </button>
            </div>
            <div className="asset-related-grid">
              {setMembers.map((m) => {
                const current = m.image === icon.image;
                return (
                  <button
                    key={m.id}
                    className={`is-icon ${current ? "current" : ""}`}
                    onClick={() => !current && onSelect(m)}
                    aria-label={m.name}
                    aria-current={current || undefined}
                  >
                    <img src={m.image} alt="" loading="lazy" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* RELATED */}
        {related.length > 0 && (
          <div className="asset-related">
            <p className="asset-label">Similar icons</p>
            <div className="asset-related-grid">
              {related.map((r) => (
                <button key={r.id} onClick={() => onSelect(r)} className="is-icon" aria-label={r.name}>
                  <img src={r.image} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IconModal;
