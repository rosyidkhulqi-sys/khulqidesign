import { useEffect, useState } from "react";
import "./AssetModal.css";

const kindLabel = { icon: "Icon", vector: "Vector", footage: "Footage" };

function saveDownload(entry) {
  try {
    const list = JSON.parse(localStorage.getItem("kd-downloads") || "[]");
    localStorage.setItem(
      "kd-downloads",
      JSON.stringify([entry, ...list].slice(0, 100))
    );
  } catch {
    /* storage unavailable */
  }
}

function AssetModal({ asset, kind, options, specs, related = [], onSelect, onTag, onClose }) {
  const [choice, setChoice] = useState(0);
  const [licenseType, setLicenseType] = useState("standard");
  const [liked, setLiked] = useState(false);

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
    saveDownload({
      id: asset.code,
      title: asset.title,
      kind,
      image: asset.image,
      format: option.label,
      license: premium ? licenseType : "free",
      date: new Date().toISOString(),
    });

    const a = document.createElement("a");
    a.href = asset.file || asset.image;
    a.download = `${asset.code}-${option.label.replace(/\W+/g, "-")}`;
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
                {asset.keywords.map((k) => (
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
                ⬇ Download {option.label}
              </button>
              <button
                className={`asset-like ${liked ? "liked" : ""}`}
                onClick={() => setLiked(!liked)}
                aria-label="Like"
              >
                {liked ? "♥" : "♡"}
              </button>
            </div>

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
            <p className="asset-label">Similar {kindLabel[kind].toLowerCase()}s</p>
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
