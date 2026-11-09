// The Background tab of the Create editor, laid out like VistaCreate's: one
// click fills the whole page with a color or a photo. The page keeps a single
// background, so choosing one replaces the last.
import { useState } from "react";
import { PagedGrid, SearchBox } from "./CreateElements";

const COLORS = [
  "#ffffff", "#f4f1ea", "#d9d9d9", "#8a8f98", "#1d1d1d", "#000000",
  "#e7212e", "#f97316", "#facc15", "#22c55e", "#0ea5e9", "#2563eb",
  "#7c3aed", "#ec4899", "#fde2e4", "#dbeafe", "#dcfce7", "#fef3c7",
];

function BackgroundPanel({ color, photo, photos, onColor, dragItem }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const found = q
    ? photos.filter((p) => `${p.name} ${p.category} ${p.keywords.join(" ")}`.toLowerCase().includes(q))
    : photos;

  return (
    <>
      {photos.length > 0 && <SearchBox value={search} onChange={setSearch} placeholder="Search backgrounds" />}

      {!q && (
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
          <label className="cp-custom">
            <input type="color" value={color} onChange={(e) => onColor(e.target.value)} />
            <span>Custom color</span>
            <strong>{color.toUpperCase()}</strong>
          </label>
        </>
      )}

      {photos.length > 0 && (
        <>
          <p className="cp-label">Photos</p>
          {found.length === 0 && <p className="cp-hint">No backgrounds found for “{search}”.</p>}
          <PagedGrid
            items={found}
            columns="two"
            renderTile={(p) => (
              <button
                key={p.id}
                className={`cp-tile wide ${photo === p.url ? "is-on" : ""}`}
                {...dragItem("background", p.id)}
                title={p.name}
              >
                <img src={p.thumb} alt={p.name} draggable={false} loading="lazy" crossOrigin="anonymous" />
              </button>
            )}
          />
        </>
      )}

      {/* a note for the owner only, while nothing has been uploaded */}
      {import.meta.env.DEV && photos.length === 0 && (
        <p className="cp-hint">Upload JPG files in Admin, Elements, and they appear here.</p>
      )}
    </>
  );
}

export default BackgroundPanel;
