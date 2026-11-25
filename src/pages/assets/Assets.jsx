// /assets: every library on one page, as Magnific's Stock: a card for each
// with its cover, what's inside and its live count.
import { useEffect, useState } from "react";
import "../vectors/Vectors.css";
import "./Assets.css";
import Breadcrumb from "../../components/Breadcrumb";
import LibraryCover from "../../components/LibraryCover";
import { libraries } from "../../data/libraries";
import { pathFor } from "../../lib/router";
import { fetchAssetCounts, formatCount } from "../../lib/assetCounts";

function Assets({ setPage }) {
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchAssetCounts().then((c) => alive && setCounts(c)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const go = (page) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    setPage(page);
    window.scrollTo(0, 0);
  };

  const total = counts ? libraries.reduce((n, l) => n + (counts[l.type] ?? 0), 0) : null;

  return (
    <section className="vectors-page assets-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="All assets" />
        <h1>
          All assets {total != null && <span className="library-count">{formatCount(total)} files</span>}
        </h1>
        <p className="assets-lead">Icons, vectors, photos, logos, templates, mockups, footage and fonts, made in-house. Download them, or edit them in Create first.</p>
      </div>

      <div className="assets-grid">
        {libraries.map((lib) => {
          const n = counts?.[lib.type] ?? 0;
          return (
            <a key={lib.page} className="assets-card" href={pathFor(lib.page)} onClick={go(lib.page)}>
              <LibraryCover library={lib} className="assets-cover" />
              <div className="assets-text">
                <strong>
                  {lib.title}
                  {lib.badge && <em>{lib.badge}</em>}
                </strong>
                <span>{lib.blurb}</span>
                <small>{counts == null ? " " : n > 0 ? `${formatCount(n)} ${n === 1 ? lib.unit[0] : lib.unit[1]}` : "Coming soon"}</small>
              </div>
            </a>
          );
        })}
        <a className="assets-card is-create" href={pathFor("create")} onClick={go("create")}>
          <span className="library-glyph assets-cover" style={{ background: "var(--red)" }}>
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 38l4-12L32 8l8 8-18 18z" />
              <path d="M28 12l8 8" />
            </svg>
          </span>
          <div className="assets-text">
            <strong>Create</strong>
            <span>Edit any template or element in your browser</span>
            <small>Free to start</small>
          </div>
        </a>
      </div>
    </section>
  );
}

export default Assets;
