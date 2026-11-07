import { useEffect, useState } from "react";
import { saveDownload } from "../lib/downloads";
import { PremiumPrompt, ToolGlyph } from "./IconControls";
import { Sparkle } from "./AiSearchButton";
import "./AssetModal.css";

const kindLabel = { icon: "Icon", vector: "Vector", footage: "Footage" };

// stock files carry up to 50 keywords for search; only a few are shown,
// so the view stays clean
const TAG_LIMIT = 8;

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

  const download = () => {
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
                <img src={asset.image} alt={asset.title} />
              )}

              {premium && (
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
              <button className="asset-download" onClick={download}>
                <ToolGlyph name="download" />
                Download {option.label}
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
