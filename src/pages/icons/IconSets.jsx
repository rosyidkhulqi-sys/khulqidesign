import { useEffect, useState } from "react";
import "./IconSets.css";
import Breadcrumb from "../../components/Breadcrumb";
import { PremiumPrompt, PremiumTag, SizePicker, Swatches } from "../../components/IconControls";
import { saveBlob, saveDownload } from "../../lib/downloads";
import { askLogin } from "../../lib/authGate";
import {
  buildIconSvg,
  canRecolor,
  defaultEdits,
  fileSlug,
  iconColors,
  loadIconSvg,
  svgDataUrl,
  svgToPng,
} from "../../lib/iconEditor";

const openOnEnter = (action) => (e) => e.key === "Enter" && action();

// A set in the library grid: six of its icons, name, count and style.
export function SetCard({ set, members, onOpen }) {
  const preview = members.slice(0, 6);

  return (
    <div
      className="set-card"
      role="button"
      tabIndex={0}
      aria-label={`${set.name} icon set, ${members.length} icons`}
      onClick={onOpen}
      onKeyDown={openOnEnter(onOpen)}
    >
      <div className="set-preview">
        {Array.from({ length: 6 }, (_, i) =>
          preview[i] ? (
            <img key={i} src={preview[i].image} alt="" loading="lazy" />
          ) : (
            <span key={i} />
          )
        )}
      </div>

      <div className="set-info">
        <strong>{set.name}</strong>
        <span>
          {members.length} {members.length === 1 ? "icon" : "icons"} ·{" "}
          <span className="set-cap">{set.style}</span>
        </span>
      </div>

      {set.license === "premium" && <span className="set-tag">Premium</span>}
    </div>
  );
}

// One set's page: every icon in it, a color and size for the whole set,
// and a ZIP download. Each icon still opens in the editor on its own.
function IconSetView({
  set,
  members,
  otherSets,
  user,
  setPage,
  onAuth,
  onBack,
  onOpenSet,
  onOpenIcon,
}) {
  const premium = set.license === "premium";
  const recolor = canRecolor(set.style);

  const [color, setColor] = useState(defaultEdits.color);
  const [px, setPx] = useState(512);
  const [sources, setSources] = useState({});
  const [busy, setBusy] = useState(null);
  // which Premium action a signed-out visitor tried
  const [prompt, setPrompt] = useState(null);

  // the SVG markup of every icon, so the grid can show the set color
  useEffect(() => {
    let alive = true;
    Promise.all(
      members.map((m) =>
        loadIconSvg(m.image).then((src) => [m.image, src]).catch(() => null)
      )
    ).then((list) => alive && setSources(Object.fromEntries(list.filter(Boolean))));
    return () => {
      alive = false;
    };
  }, [members]);

  const edits = { ...defaultEdits, color: recolor ? color : null };
  const recolored = recolor && color !== defaultEdits.color;
  const ready = members.every((m) => sources[m.image]);

  const previewOf = (icon) =>
    recolored && sources[icon.image]
      ? svgDataUrl(buildIconSvg(sources[icon.image], edits))
      : icon.image;

  const downloadSet = async (format) => {
    if (!user) {
      askLogin("download");
      return;
    }
    if (!user && (premium || format === "svg")) {
      setPrompt(format);
      return;
    }
    setPrompt(null);
    setBusy(format);
    try {
      // loaded only when needed, so the library stays light
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const folder = zip.folder(`${set.id}-${format}-${px}px`);

      for (const icon of members) {
        const svg = buildIconSvg(sources[icon.image], edits, px);
        const name = fileSlug(icon.name);
        if (format === "svg") folder.file(`${name}.svg`, svg);
        else folder.file(`${name}-${px}px.png`, await svgToPng(svg, px));
      }

      folder.file(
        "LICENSE.txt",
        premium
          ? `${set.name} by Khulqidesign\nPremium license: commercial use, no attribution required.\n`
          : `${set.name} by Khulqidesign\nFree for personal and commercial use.\nAttribution required: "Icons by Khulqidesign"\n`
      );

      saveBlob(await zip.generateAsync({ type: "blob" }), `${set.id}-${format}-${px}px.zip`);
      saveDownload({
        id: set.id,
        title: `${set.name} (icon set)`,
        kind: "icon",
        image: members[0].image,
        file: members[0].image,
        format: `${format.toUpperCase()} set ${px}px`,
        license: premium ? "standard" : "free",
        date: new Date().toISOString(),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Breadcrumb
        setPage={setPage}
        parent={{ label: "Icons", onClick: onBack }}
        current={set.name}
      />

      <div className="set-layout">
        <div className="set-main">
          <div className="set-head">
            <h1>{set.name}</h1>
            <span>
              {members.length} {members.length === 1 ? "icon" : "icons"}
            </span>
          </div>
          <p className="set-desc">{set.description}</p>

          <div className="results-grid set-icons">
            {members.map((icon) => {
              const open = () => onOpenIcon(icon, recolor ? { color } : null, px);
              return (
                <div
                  key={icon.id}
                  className="icon-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`${icon.name} icon`}
                  onClick={open}
                  onKeyDown={openOnEnter(open)}
                >
                  <div className="icon-preview">
                    <img src={previewOf(icon)} alt="" className="small-icon" />
                  </div>
                  <div className="icon-info">
                    <span>{icon.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="set-panel">
          <span className={`set-badge ${set.license}`}>
            {premium ? "Premium" : "Free"} icon set
          </span>
          <h2>{set.name}</h2>
          <p className="set-meta">
            {members.length} icons · <span className="set-cap">{set.style}</span> · by{" "}
            <strong>Khulqidesign</strong>
          </p>

          {/* CUSTOMIZE ALL */}
          <p className="set-label">Color for all icons</p>
          <div className="set-row">
            {recolor ? (
              <Swatches list={iconColors} value={color} onChange={setColor} label="Set color" />
            ) : (
              <span className="set-fixed">
                {set.style === "gradient" ? "Gradient" : "Multi-color"} icons: colors are fixed.
              </span>
            )}
          </div>

          <p className="set-label">Size</p>
          <SizePicker value={px} onChange={setPx} />

          <div className="ie-download">
            <button className="ie-png" onClick={() => downloadSet("png")} disabled={!ready || busy}>
              {busy === "png" ? "Preparing…" : <>⬇ PNG set{premium && <PremiumTag />}</>}
            </button>
            <button className="ie-svg" onClick={() => downloadSet("svg")} disabled={!ready || busy}>
              {busy === "svg" ? "Preparing…" : <>⬇ SVG set<PremiumTag /></>}
            </button>
          </div>

          {prompt ? (
            <PremiumPrompt
              title={premium ? "This is a Premium set" : "SVG is part of Premium"}
              text={premium
                ? "Premium sets come with a subscription: every format, no attribution."
                : "Get the whole set as editable vectors. The PNG set stays free."}
              onAuth={onAuth}
              onDismiss={() => setPrompt(null)}
            />
          ) : (
            <p className="ie-premium">
              {members.length} icons in one ZIP{recolored ? ", in your color" : ""}.
              {premium ? " Included with Premium." : " PNG is free; SVG is Premium."}
            </p>
          )}

          <table className="set-specs">
            <tbody>
              <tr><th>Icons</th><td>{members.length}</td></tr>
              <tr><th>Style</th><td className="set-cap">{set.style}</td></tr>
              <tr><th>Formats</th><td>SVG, PNG · 16–512 px</td></tr>
              <tr><th>License</th><td>{premium ? "Premium" : "Free with attribution"}</td></tr>
            </tbody>
          </table>

          {otherSets.length > 0 && (
            <div className="set-others">
              <p className="set-label">Other icon sets</p>
              {otherSets.map((other) => (
                <button key={other.id} onClick={() => onOpenSet(other)}>
                  <span className="set-others-name">{other.name}</span>
                  <span className="set-cap">{other.style}</span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

export default IconSetView;
