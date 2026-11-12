import { useEffect, useRef, useState } from "react";
import { DOWNLOAD_REFUSALS, requestDownload, saveDownload } from "../lib/downloads";
import { askLogin } from "../lib/authGate";
import { PremiumPrompt, ToolGlyph } from "./IconControls";
import { Sparkle } from "./AiSearchButton";
import "./AssetModal.css";

const kindLabel = { icon: "Icon", vector: "Vector", footage: "Footage" };

// stock files carry up to 50 keywords for search; only a few are shown,
// so the view stays clean
const TAG_LIMIT = 8;


// The preview opens full screen on click. There, a click zooms in on the spot
// under the pointer and moving looks around; another click zooms back out.
// Pointer events, so a tap and a drag work the same way on touch screens.
const ZOOM = 2.5;

function Lightbox({ src, alt, onClose }) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");

  // Esc closes this view only, not the detail window under it
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const aim = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    setOrigin(`${x}% ${y}%`);
  };

  return (
    <div className="asset-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button className="asset-lightbox-close" onClick={onClose} aria-label="Close">✕</button>
      <div
        className={`asset-lightbox-stage ${zoomed ? "is-zoomed" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          aim(e);
          setZoomed(!zoomed);
        }}
        onPointerMove={(e) => zoomed && aim(e)}
      >
        <img src={src} alt={alt} draggable={false}
             style={{ transformOrigin: origin, transform: zoomed ? `scale(${ZOOM})` : "none" }} />
      </div>
      <span className="asset-zoom-hint is-shown" aria-hidden="true">
        {zoomed ? "Click to zoom out" : "Click to zoom in · Esc to close"}
      </span>
    </div>
  );
}

// In the detail view: press and hold to magnify the spot under the pointer
// and move to look around (release to let go); a quick click opens the
// picture full screen.
const HOLD_MS = 160;

function ZoomImage({ src, alt }) {
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const timer = useRef(null);
  // the press turned into a hold, so letting go mustn't open full screen
  const holding = useRef(false);

  const aim = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    setOrigin(`${x}% ${y}%`);
  };

  const press = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    aim(e);
    holding.current = false;
    timer.current = setTimeout(() => {
      holding.current = true;
      setHeld(true);
    }, HOLD_MS);
  };

  const release = () => {
    clearTimeout(timer.current);
    if (holding.current) {
      holding.current = false;
      setHeld(false);
      return;
    }
    setOpen(true);
  };

  const cancel = () => {
    clearTimeout(timer.current);
    holding.current = false;
    setHeld(false);
  };

  return (
    <>
      <button
        className={`asset-zoom ${held ? "is-held" : ""}`}
        onPointerDown={press}
        onPointerMove={(e) => held && aim(e)}
        onPointerUp={release}
        onPointerCancel={cancel}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(true))}
        aria-label="View larger"
      >
        <img src={src} alt={alt} draggable={false}
             style={{ transformOrigin: origin, transform: held ? `scale(${ZOOM})` : "none" }} />
        <span className="asset-zoom-hint" aria-hidden="true">Hold to zoom · click to view larger</span>
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function AssetModal({
  asset,
  kind,
  options,
  specs,
  related = [],
  user = null,
  onAuth,
  onSelect,
  onTag,
  onClose,
}) {
  const [choice, setChoice] = useState(0);
  const [licenseType, setLicenseType] = useState("standard");
  const [liked, setLiked] = useState(false);
  // a signed-out visitor tried to download a Premium file
  const [prompt, setPrompt] = useState(false);
  // uploaded originals: why the server refused, or that it's working
  const [refusal, setRefusal] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const premium = asset.license === "premium";
  const option = options[choice];

  const download = async () => {
    // every download needs an account (a free one is enough)
    if (!user) {
      askLogin("download");
      return;
    }
    // uploaded originals: the server checks the license and hands out a link
    if (option.pending) {
      setBusy(true);
      setRefusal(null);
      try {
        const result = await requestDownload(asset.dbId, option.format);
        saveDownload({
          id: asset.code,
          title: asset.title,
          kind,
          image: asset.image,
          file: null,
          format: option.label,
          license: result.license,
          date: new Date().toISOString(),
        });
      } catch (e) {
        setRefusal(e.code in DOWNLOAD_REFUSALS ? e.code : e.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    // Premium preview: the real check moves to the server with the backend
    if (premium && !user) {
      setPrompt(true);
      return;
    }
    saveDownload({
      id: asset.code,
      title: asset.title,
      kind,
      image: asset.image,
      file: option.file || asset.file || asset.image,
      format: option.label,
      license: premium ? licenseType : "free",
      date: new Date().toISOString(),
    });

    // an option can point at its own file (EPS, JPG...); otherwise the asset's
    const a = document.createElement("a");
    a.href = option.file || asset.file || asset.image;
    a.download = `${asset.code}-${option.label.replace(/\W+/g, "-")}${option.ext ? `.${option.ext}` : ""}`;
    a.click();
  };

  return (
    <div className="asset-overlay" onClick={onClose}>
      <div className="asset-modal" onClick={(e) => e.stopPropagation()}>
        <button className="asset-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="asset-body">
          {/* PREVIEW */}
          <div className="asset-left">
            <div className={`asset-preview is-${kind}`}>
              {kind === "footage" ? (
                <video src={asset.file} poster={asset.image} autoPlay muted loop playsInline controls />
              ) : (
                // uploaded assets have a larger preview; the watermark is in its pixels
                <ZoomImage src={asset.previewImage || asset.image} alt={asset.title} />
              )}

              {premium && !asset.previewImage && (
                <div className="asset-watermark" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i}>KHULQIDESIGN</span>
                  ))}
                </div>
              )}
            </div>

            <div className="asset-keywords">
              <p>Keywords</p>
              <div>
                {asset.keywords.slice(0, TAG_LIMIT).map((k) => (
                  <button key={k} onClick={() => onTag(k)}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* DETAILS */}
          <div className="asset-right">
            <span className={`asset-license ${asset.license}`}>
              {premium ? "Premium" : "Free"} {kindLabel[kind]}
            </span>
            <h2>{asset.title}</h2>
            <p className="asset-meta">
              ID {asset.code} · by <strong>Khulqidesign</strong>
            </p>

            <p className="asset-label">Download options</p>
            <div className="asset-options">
              {options.map((o, i) => (
                <label key={o.label} className={choice === i ? "active" : ""}>
                  <input
                    type="radio"
                    name="asset-option"
                    checked={choice === i}
                    onChange={() => setChoice(i)}
                  />
                  <span className="opt-name">
                    {o.label}
                    <small>{o.detail}</small>
                  </span>
                  <span className="opt-size">{o.size}</span>
                </label>
              ))}
            </div>

            {premium ? (
              <>
                <p className="asset-label">License</p>
                <div className="asset-licenses">
                  <button
                    className={licenseType === "standard" ? "active" : ""}
                    onClick={() => setLicenseType("standard")}
                  >
                    Standard
                    <small>Web, social, print up to 500k copies</small>
                  </button>
                  <button
                    className={licenseType === "extended" ? "active" : ""}
                    onClick={() => setLicenseType("extended")}
                  >
                    Extended
                    <small>Unlimited copies, merchandise & resale</small>
                  </button>
                </div>
              </>
            ) : (
              <p className="asset-note">
                Free for personal & commercial use. Attribution required:
                <em> "Designed by Khulqidesign"</em>
              </p>
            )}

            <div className="asset-buttons">
              <button className="asset-download" onClick={download} disabled={busy}>
                <ToolGlyph name="download" />
                {busy ? "Preparing…" : `Download ${option.label}`}
              </button>
              <button
                className={`asset-like ${liked ? "liked" : ""}`}
                onClick={() => setLiked(!liked)}
                aria-label={liked ? "Saved" : "Save"}
                aria-pressed={liked}
              >
                <ToolGlyph name="heart" size={20} filled={liked} />
              </button>
            </div>

            {/* Image to video needs the AI backend; until that tool is built
                the button only shows what's coming */}
            {kind === "vector" && (
              <button className="asset-ai" disabled>
                <Sparkle size={16} />
                Make a video
                <span className="ai-soon">Coming soon</span>
              </button>
            )}

            {refusal && (
              DOWNLOAD_REFUSALS[refusal] ? (
                <PremiumPrompt
                  title={DOWNLOAD_REFUSALS[refusal].title}
                  text={DOWNLOAD_REFUSALS[refusal].text}
                  onAuth={onAuth}
                  onDismiss={() => setRefusal(null)}
                />
              ) : (
                <p className="asset-note">Couldn't start the download: {refusal}</p>
              )
            )}

            {prompt && (
              <PremiumPrompt
                title={kind === "footage"
                  ? "This is Premium footage"
                  : `This is a Premium ${kindLabel[kind].toLowerCase()}`}
                text="Premium files come with a subscription: every format, commercial use, no attribution."
                onAuth={onAuth}
                onDismiss={() => setPrompt(false)}
              />
            )}

            <table className="asset-specs">
              <tbody>
                {specs.map(([label, value]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RELATED */}
        {related.length > 0 && (
          <div className="asset-related">
            {/* "footage" has no plural */}
            <p className="asset-label">
              Similar {kindLabel[kind].toLowerCase()}{kind === "footage" ? "" : "s"}
            </p>
            <div className="asset-related-grid">
              {related.map((r) => (
                <button key={r.id} onClick={() => onSelect(r)} className={`is-${kind}`}>
                  <img src={r.image} alt={r.title} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AssetModal;
