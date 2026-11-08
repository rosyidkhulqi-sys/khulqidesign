import { useEffect, useState } from "react";
import "./Vectors.css";
import AssetModal from "../../components/AssetModal";
import Breadcrumb from "../../components/Breadcrumb";
import AiSearchButton from "../../components/AiSearchButton";
import { ToolGlyph } from "../../components/IconControls";
import { vectors as trialVectors } from "../../data/vectorsData";
import { fetchPublished, toVector } from "../../lib/catalog";

const formats = ["EPS", "AI", "SVG", "PNG", "JPG"];

const px = ([w, h]) => `${w} × ${h}`;
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// one option per real file; each downloads that file
function vectorOptions(v) {
  return [
    {
      label: "EPS",
      detail: `Editable vector · ${px(v.artboard)} pt`,
      size: v.sources.EPS.size,
      file: v.sources.EPS.url,
      // uploaded originals wait for signed download links
      pending: !v.sources.EPS.url,
      format: "EPS",
      ext: "eps",
    },
    {
      label: "JPG",
      detail: `${px(v.preview)} px`,
      size: v.sources.JPG.size,
      file: v.sources.JPG.url,
      pending: !v.sources.JPG.url,
      format: "JPG",
      ext: "jpg",
    },
  ];
}

function vectorSpecs(v) {
  return [
    ["File ID", v.code],
    ["Formats", v.files.join(", ")],
    ["Artboard", `${px(v.artboard)} pt`],
    ["JPG size", `${px(v.preview)} px`],
    ["Editable", "Yes, layered vector"],
    ["Orientation", capitalize(v.orientation)],
    ["Category", capitalize(v.category)],
    ["Release", "Not required"],
  ];
}

function Vectors({ setPage, initialSearch = "", user = null }) {
  const [search, setSearch] = useState(initialSearch);
  const [format, setFormat] = useState("all");
  const [license, setLicense] = useState("all");
  const [orientation, setOrientation] = useState("all");
  const [sort, setSort] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  // vectors uploaded through /admin, newest first, ahead of the trial files
  const [uploaded, setUploaded] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchPublished("vector")
      .then((rows) => alive && setUploaded(rows.map(toVector)))
      .catch(() => {
        /* the trial files still show if the catalogue can't be reached */
      });
    return () => {
      alive = false;
    };
  }, []);

  const allVectors = [...uploaded, ...trialVectors];

  const perPage = 24;

  const reset = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const q = search.toLowerCase();
  const filtered = allVectors
    // the short title, the file's own title and description, a whole keyword
    // phrase ("copy space"), or the start of any word in a keyword ("lantern"
    // finds "jack o lantern")
    .filter((v) =>
      v.title.toLowerCase().includes(q) ||
      v.searchText.includes(q) ||
      v.keywords.some((k) => k.startsWith(q) || k.split(" ").some((word) => word.startsWith(q)))
    )
    .filter((v) => format === "all" || v.files.includes(format))
    .filter((v) => license === "all" || v.license === license)
    .filter((v) => orientation === "all" || v.orientation === orientation)
    .sort((a, b) =>
      sort === "popular" ? b.downloads - a.downloads : b.id - a.id
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const items = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const clearFilters = () => {
    setFormat("all");
    setLicense("all");
    setOrientation("all");
    setSort("popular");
    setSearch("");
    setCurrentPage(1);
  };

  const hasFilter =
    format !== "all" || license !== "all" || orientation !== "all" || search;

  const searchTag = (tag) => {
    setSelected(null);
    setSearch(tag);
    setCurrentPage(1);
  };

  return (
    <section className="vectors-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="Vectors" />
        {/* the count sits by the title, so results start higher */}
        <h1>
          Vectors <span className="library-count">{filtered.length} vectors</span>
        </h1>
      </div>

      {/* SEARCH */}
      <div className="icon-search">
        <select className="search-type" value="vectors" onChange={() => {}}>
          <option value="vectors">Vectors</option>
        </select>
        <input
          type="text"
          placeholder="Search vectors, backgrounds, illustrations, patterns..."
          value={search}
          onChange={reset(setSearch)}
        />
        <AiSearchButton example="Halloween poster with a castle and a full moon" />
        <button className="search-submit" aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </button>
      </div>

      {/* FILTER ROW */}
      <div className="vector-filters">
        <select value={format} onChange={reset(setFormat)}>
          <option value="all">File format</option>
          {formats.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <select value={license} onChange={reset(setLicense)}>
          <option value="all">License</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>

        <select value={orientation} onChange={reset(setOrientation)}>
          <option value="all">Orientation</option>
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
          <option value="square">Square</option>
        </select>

        {hasFilter && (
          <button className="clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        )}

        <div className="vector-sort">
          <select value={sort} onChange={reset(setSort)}>
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* GRID */}
      <div className="vector-grid">
        {items.length > 0 ? (
          items.map((v) => (
            <div
              className="vector-card"
              key={v.id}
              role="button"
              tabIndex={0}
              aria-label={v.title}
              onClick={() => setSelected(v)}
              onKeyDown={(e) => e.key === "Enter" && setSelected(v)}
            >
              {/* the real shape of the artwork, so nothing is cropped */}
              <div className="vector-thumb" style={{ aspectRatio: `${v.artboard[0]} / ${v.artboard[1]}` }}>
                <img src={v.image} alt="" loading="lazy" />
                <span className={`vector-badge ${v.license}`}>
                  {v.license === "free" ? "Free" : "Premium"}
                </span>
                <span className="vector-format">{v.format}</span>
                {/* downloads go through the detail view, where the license is shown */}
                <div className="vector-actions" onClick={(e) => e.stopPropagation()}>
                  <button aria-label="Save">
                    <ToolGlyph name="heart" size={16} />
                  </button>
                </div>
              </div>
              <p className="vector-name">{v.title}</p>
            </div>
          ))
        ) : (
          <div className="no-results">
            <h3>No vectors found</h3>
            <p>Try another search or filter.</p>
            {hasFilter && (
              <button className="clear-filters" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* PAGINATION */}
      <div className="pagination">
        <button
          className="page-arrow"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          ‹
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
          .map((p) => (
            <button
              key={p}
              className={`page-number ${currentPage === p ? "active" : ""}`}
              onClick={() => setCurrentPage(p)}
            >
              {p}
            </button>
          ))}
        <button
          className="page-arrow"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          ›
        </button>
      </div>

      {selected && (
        <AssetModal
          key={selected.id}
          asset={selected}
          kind="vector"
          options={vectorOptions(selected)}
          specs={vectorSpecs(selected)}
          related={allVectors
            .filter((v) => v.category === selected.category && v.id !== selected.id)
            .slice(0, 6)}
          user={user}
          onAuth={(target) => {
            setSelected(null);
            setPage(target);
            window.scrollTo(0, 0);
          }}
          onSelect={setSelected}
          onTag={searchTag}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

export default Vectors;