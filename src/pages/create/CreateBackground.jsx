// The Background tab of the Create editor, laid out like VistaCreate's: one
// click fills the whole page with a color or a photo. The page keeps a single
// background, so choosing one replaces the last.
import { DbGrid, PremiumMark } from "./CreateElements";
import { fetchCreateBackgrounds } from "../../lib/catalog";

const COLORS = [
  "#ffffff", "#f4f1ea", "#d9d9d9", "#8a8f98", "#1d1d1d", "#000000",
  "#e7212e", "#f97316", "#facc15", "#22c55e", "#0ea5e9", "#2563eb",
  "#7c3aed", "#ec4899", "#fde2e4", "#dbeafe", "#dcfce7", "#fef3c7",
];

export function PhotoTile({ photo, on, dragItem }) {
  return (
    <button className={`cp-tile wide ${on ? "is-on" : ""}`} {...dragItem("background", photo.id)} title={photo.name}>
      <img src={photo.thumb} alt={photo.name} draggable={false} loading="lazy" crossOrigin="anonymous" />
      {photo.premium && <PremiumMark />}
    </button>
  );
}

// the library's backgrounds (Photos' Backgrounds & Textures, vector
// backgrounds ticked "Use in Create"), then backgrounds made for Create
const LIBRARY_BACKGROUNDS = {};

function BackgroundPanel({ color, photo, photos, onColor, onEditColor, dragItem, learn }) {
  return (
    <>
          <p className="cp-label">Color</p>
          <div className="cp-swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`cp-swatch ${!photo && color === c ? "is-on" : ""}`}
                style={{ background: c }}
                onClick={() => onColor(c)}
                title={c}
                aria-label={`Background color ${c}`}
                aria-pressed={!photo && color === c}
              />
            ))}
          </div>
          <button className="cp-custom" onClick={onEditColor}>
            <i style={{ backgroundColor: color }} />
            <span>Custom color</span>
            <strong>{color.toUpperCase()}</strong>
          </button>

      <p className="cp-label">Photos</p>
      <DbGrid
        query={LIBRARY_BACKGROUNDS}
        fetchPage={fetchCreateBackgrounds}
        after={photos}
        learn={learn}
        columns="two"
        renderTile={(p) => <PhotoTile key={p.id} photo={p} on={photo === p.url} dragItem={dragItem} />}
      />
    </>
  );
}

export default BackgroundPanel;
