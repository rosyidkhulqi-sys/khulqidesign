// The Assets mega menu: every library with its cover, blurb and live count.
// Used in the site header and in Create's bar. onPick(lib, e) runs instead
// of the default navigation when it returns true (Create opens some
// libraries in its own panel and the rest in a new tab).
import { useEffect, useRef, useState } from "react";
import { libraries, libraryPages } from "../data/libraries";
import { fetchAssetCounts, formatCount } from "../lib/assetCounts";
import { pathFor } from "../lib/router";
import LibraryCover from "./LibraryCover";

function AssetsMenu({ page, go, onPick, buttonClass = "site-assets-button", align = "center", label = "Assets" }) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState(null);
  const box = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (!open || counts) return;
    fetchAssetCounts().then(setCounts).catch(() => {});
  }, [open, counts]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => !box.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // opens on hover (a short delay before closing, so the pointer can travel
  // down into the panel) and on click or keyboard
  const hover = (on) => {
    clearTimeout(closeTimer.current);
    if (on) setOpen(true);
    else closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  const pick = (target, lib) => (e) => {
    if (lib && onPick?.(lib, e)) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    setOpen(false);
    go(target)(e);
  };

  return (
    <div className={`site-assets is-${align}`} ref={box} onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)}>
      <button
        className={`${buttonClass} ${libraryPages.has(page) ? "active" : ""} ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
        <svg className="site-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="site-assets-panel">
          <div className="site-assets-grid">
            {libraries.map((lib) => (
              <a key={lib.page} href={pathFor(lib.page)} onClick={pick(lib.page, lib)}
                 className={`site-assets-item ${page === lib.page ? "active" : ""}`}>
                <LibraryCover library={lib} className="site-assets-cover" />
                <span className="site-assets-text">
                  <strong>
                    {lib.title}
                    {lib.badge && <em>{lib.badge}</em>}
                  </strong>
                  <small>{lib.blurb}</small>
                </span>
                {counts?.[lib.type] > 0 && <span className="site-assets-count">{formatCount(counts[lib.type])}</span>}
              </a>
            ))}
          </div>
          <a className="site-assets-all" href={pathFor("assets")} onClick={pick("assets")}>
            Browse all assets <span aria-hidden="true">→</span>
          </a>
        </div>
      )}
    </div>
  );
}

export default AssetsMenu;
