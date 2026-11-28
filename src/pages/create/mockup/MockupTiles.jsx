// Elements → Mockups: the published mockups that have a kit, as tiles.
// Clicking one opens the Mockup Studio.
import { PremiumMark } from "../CreateElements";

export default function MockupTiles({ mockups, onOpen }) {
  if (!mockups) return <p className="cp-hint">Loading mockups…</p>;
  if (!mockups.length) return <p className="cp-hint">No mockups yet.</p>;
  return (
    <>
      <div className="cp-grid two">
        {mockups.map((m) => (
          <button key={m.code} className="cp-tile wide" title={m.title}
                  onClick={() => onOpen({ code: m.code, title: m.title, premium: m.license !== "free", image: m.image })}>
            <img src={m.image} alt={m.title} draggable={false} loading="lazy" />
            {m.license !== "free" && <PremiumMark />}
          </button>
        ))}
      </div>
      <p className="cp-hint">Select a logo or element first and it goes straight onto the mockup; or pick one and put a page on it in the Studio.</p>
    </>
  );
}
