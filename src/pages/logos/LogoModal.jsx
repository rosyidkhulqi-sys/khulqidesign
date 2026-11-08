// Logo detail: the logo in a few mockups, what the pack contains, and one
// action per license. Free downloads now; Premium asks signed-out visitors
// to log in (the real subscription check comes with the backend); Exclusive
// shows the USD price with checkout marked Coming soon, or that it has sold.
// Builds on AssetModal.css for the layout.
import { useEffect, useState } from "react";
import { DOWNLOAD_REFUSALS, requestDownload, saveDownload } from "../../lib/downloads";
import { PremiumPrompt, ToolGlyph } from "../../components/IconControls";
import { industryName, styleName } from "../../data/logosData";
import "../../components/AssetModal.css";
import "./LogoModal.css";

// stock files carry many keywords for search; only a few are shown
const TAG_LIMIT = 8;

const mockups = [
  ["logo", "Logo"],
  ["dark", "On dark"],
  ["card", "Business card"],
  ["social", "Social"],
];

// what every logo pack will hold once the backend serves the master files
const packFiles = [
  ["AI, EPS", "Editable vector, layered"],
  ["SVG", "For web and Figma"],
  ["PNG", "Transparent, up to 5000 px"],
  ["PDF", "Print ready"],
  ["Guide", "Fonts and color codes"],
];

const licenseLabel = { free: "Free", premium: "Premium", exclusive: "Exclusive" };

function Mockup({ logo, view }) {
  if (view === "card") {
    return (
      <div className="lm-desk">
        <div className="lm-card lm-card-back" />
        <div className="lm-card">
          <img src={logo.image} alt="" />
        </div>
      </div>
    );
  }
  if (view === "social") {
    return (
      <div className="lm-social">
        <div className="lm-cover" />
        <div className="lm-avatar"><img src={logo.image} alt="" /></div>
        <div className="lm-lines"><span /><span /></div>
      </div>
    );
  }
  // "dark": an inverted preview until each pack ships its own dark version
  return <img className={view === "dark" ? "lm-dark" : ""} src={logo.previewImage || logo.image} alt={logo.title} />;
}

function LogoModal({ logo, related = [], user = null, onAuth, onSelect, onTag, onClose }) {
  const [view, setView] = useState("logo");
  const [liked, setLiked] = useState(false);
  const [prompt, setPrompt] = useState(false);
  // uploaded logos: which source file to download, and why one was refused
  const [format, setFormat] = useState(logo.originals?.[0]?.format ?? null);
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

  const { license, price, sold } = logo;

  // uploaded logos: the real files, handed out by the server after its checks
  const uploaded = Boolean(logo.originals);

  const download = async () => {
    if (uploaded) {
      if (!user) {
        setRefusal("sign_in_required");
        return;
      }
      setBusy(true);
      setRefusal(null);
      try {
        const result = await requestDownload(logo.dbId, format);
        saveDownload({
          id: logo.code,
          title: logo.title,
          kind: "logo",
          image: logo.image,
          file: null,
          format,
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
    if (license === "premium" && !user) {
      setPrompt(true);
      return;
    }
    saveDownload({
      id: logo.code,
      title: logo.title,
      kind: "logo",
      image: logo.image,
      file: logo.image,
      format: "JPG preview",
      license: license === "free" ? "free" : "standard",
      date: new Date().toISOString(),
    });
    // only the preview exists in the trial; the full pack comes from the backend
    const a = document.createElement("a");
    a.href = logo.image;
    a.download = `${logo.code}.jpg`;
    a.click();
  };

  return (
    <div className="asset-overlay" onClick={onClose}>
      <div
        className="asset-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${logo.title} logo`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="asset-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="asset-body">
          {/* PREVIEW + MOCKUPS */}
          <div className="asset-left">
            <div className={`asset-preview lm-stage is-${view}`}>
              <Mockup logo={logo} view={view} />
              {license !== "free" && view === "logo" && !logo.previewImage && (
                <div className="asset-watermark" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i}>KHULQIDESIGN</span>
                  ))}
                </div>
              )}
              {sold && <span className="logo-sold">Sold</span>}
            </div>

            <div className="lm-views" role="tablist" aria-label="Preview">
              {mockups.map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={view === id}
                  className={view === id ? "active" : ""}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="asset-keywords">
              <p>Keywords</p>
              <div>
                {logo.keywords.slice(0, TAG_LIMIT).map((k) => (
                  <button key={k} onClick={() => onTag(k)}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* DETAILS */}
          <div className="asset-right">
            <span className={`asset-license ${license}`}>
              {licenseLabel[license]} logo
            </span>
            <h2>{logo.title}</h2>
            <p className="asset-meta">
              ID {logo.code} · by <strong>Khulqidesign</strong>
            </p>

            {license === "exclusive" && (
              <div className="lm-price">
                <strong>{sold ? "Sold" : `$${price}`}</strong>
                <span>{sold ? "Bought outright by one buyer" : "One-time purchase · one buyer only"}</span>
              </div>
            )}

            <p className="asset-label">What you get</p>
            {uploaded ? (
              // the files this logo really has; pick one to download
              <div className="asset-options">
                {logo.originals.map((o) => (
                  <label key={o.format} className={format === o.format ? "active" : ""}>
                    <input type="radio" name="logo-file" checked={format === o.format} onChange={() => setFormat(o.format)} />
                    <span className="opt-name">
                      {o.format}
                      <small>{o.label}</small>
                    </span>
                    <span className="opt-size">{(o.bytes / 1_000_000).toFixed(1)} MB</span>
                  </label>
                ))}
              </div>
            ) : (
              <ul className="lm-files">
                {packFiles.map(([name, detail]) => (
                  <li key={name}>
                    <b>{name}</b>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="asset-buttons">
              {license === "exclusive" ? (
                sold ? (
                  <p className="lm-sold-note">This logo has been sold and is no longer available.</p>
                ) : (
                  <button className="asset-download lm-buy" disabled>
                    Buy for ${price}
                    <span className="ai-soon">Checkout coming soon</span>
                  </button>
                )
              ) : (
                <button className="asset-download" onClick={download} disabled={busy}>
                  <ToolGlyph name="download" />
                  {busy ? "Preparing…" : uploaded ? `Download ${format}` : "Download"}
                </button>
              )}
              <button
                className={`asset-like ${liked ? "liked" : ""}`}
                onClick={() => setLiked(!liked)}
                aria-label={liked ? "Saved" : "Save"}
                aria-pressed={liked}
              >
                <ToolGlyph name="heart" size={20} filled={liked} />
              </button>
            </div>

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
                title="This is a Premium logo"
                text="Premium logos come with a subscription: every file, commercial use, no attribution."
                onAuth={onAuth}
                onDismiss={() => setPrompt(false)}
              />
            )}

            {license === "free" && (
              <p className="asset-note">
                Free for personal & commercial use. Attribution required:
                <em> "Logo by Khulqidesign"</em>
              </p>
            )}
            {license === "premium" && (
              <p className="asset-note">
                <em>Non-exclusive.</em> Included with a subscription. Other subscribers may
                use the same logo, so change the name and colors to make it yours.
              </p>
            )}
            {license === "exclusive" && !sold && (
              <p className="asset-note">
                <em>Exclusive.</em> After purchase the logo is taken off sale and the full
                rights and files are yours alone.
              </p>
            )}

            <table className="asset-specs">
              <tbody>
                <tr><th>Logo ID</th><td>{logo.code}</td></tr>
                <tr><th>Industry</th><td>{industryName[logo.industry]}</td></tr>
                <tr><th>Style</th><td>{styleName[logo.style]}</td></tr>
                <tr><th>License</th><td>{licenseLabel[license]}{license === "premium" ? ", non-exclusive" : ""}</td></tr>
                <tr><th>Editable text</th><td>Yes, name and tagline</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* RELATED */}
        {related.length > 0 && (
          <div className="asset-related">
            <p className="asset-label">Similar logos</p>
            <div className="asset-related-grid">
              {related.map((r) => (
                <button key={r.id} onClick={() => onSelect(r)} className="is-icon" aria-label={r.title}>
                  <img className="lm-related" src={r.image} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LogoModal;
