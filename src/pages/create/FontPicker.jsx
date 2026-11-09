// The font list in Create's inspector: each name in its own font, in groups,
// with a search. It opens in place, so the inspector's scroll can't clip it.
import { useEffect, useRef, useState } from "react";
import { fontGroups, linkFonts } from "./createFonts";

// a row takes on its font once scrolled into view, so opening the list
// doesn't download every font
function FontRow({ font, on, onPick }) {
  const row = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const watch = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setSeen(true);
      watch.disconnect();
    });
    watch.observe(row.current);
    return () => watch.disconnect();
  }, []);

  return (
    <button ref={row} type="button" className={`fp-font ${on ? "is-on" : ""}`}
            style={seen ? { fontFamily: `"${font}"` } : undefined} onClick={() => onPick(font)}>
      {font}
    </button>
  );
}

function FontPicker({ value, onPick }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    linkFonts();
    const onDown = (e) => {
      if (!box.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = search.trim().toLowerCase();
  const groups = fontGroups
    .map((g) => ({ ...g, fonts: g.fonts.filter((f) => f.toLowerCase().includes(q)) }))
    .filter((g) => g.fonts.length > 0);

  const pick = (font) => {
    setOpen(false);
    setSearch("");
    onPick(font);
  };

  return (
    <div className="fp" ref={box}>
      <button type="button" className="fp-current" style={{ fontFamily: `"${value}"` }}
              aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{value}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="fp-menu">
          <input className="fp-search" type="search" placeholder="Search fonts" aria-label="Search fonts" autoFocus
                 value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="fp-list">
            {groups.length === 0 && <p className="fp-none">No fonts found.</p>}
            {groups.map((g) => (
              <div key={g.name}>
                <p className="fp-group">{g.name}</p>
                {g.fonts.map((f) => (
                  <FontRow key={f} font={f} on={f === value} onPick={pick} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FontPicker;
