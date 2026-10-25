import { useState } from "react";
import PageHeader from "./PageHeader";
import "./Vectors.css";

const previews = ["/preview2.jpg", "/preview3.jpg", "/preview4.jpg", "/preview1.jpg"];
const formats = ["SVG", "EPS", "AI", "PNG", "JPG"];
const orientations = ["landscape", "portrait", "square"];

const allVectors = Array.from({ length: 120 }, (_, i) => ({
  id: i + 1,
  name: `Vector ${i + 1}`,
  image: previews[i % previews.length],
  format: formats[i % formats.length],
  license: i % 3 === 0 ? "premium" : "free",
  orientation: orientations[i % 3],
  downloads: (i * 37) % 500,
}));

const ratio = { landscape: "4 / 3", portrait: "3 / 4", square: "1 / 1" };

function Vectors({ setPage }) {
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("all");
  const [license, setLicense] = useState("all");
  const [orientation, setOrientation] = useState("all");
  const [sort, setSort] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);

  const perPage = 24;

  const reset = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const filtered = allVectors
    .filter((v) => v.name.toLowerCase().includes(search.toLowerCase()))
    .filter((v) => format === "all" || v.format === format)
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

  return (
    <section className="vectors-page">
      <PageHeader page="vectors" setPage={setPage} />

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

      <p className="vector-count">{filtered.length} vectors</p>

      {/* GRID */}
      <div className="vector-grid">
        {items.length > 0 ? (
          items.map((v) => (
            <div className="vector-card" key={v.id}>
              <div className="vector-thumb" style={{ aspectRatio: ratio[v.orientation] }}>
                <img src={v.image} alt={v.name} loading="lazy" />
                <span className={`vector-badge ${v.license}`}>
                  {v.license === "free" ? "Free" : "Premium"}
                </span>
                <span className="vector-format">{v.format}</span>
                <div className="vector-actions">
                  <button aria-label="Like">♡</button>
                  <button aria-label="Download">⬇</button>
                </div>
              </div>
              <p className="vector-name">{v.name}</p>
            </div>
          ))
        ) : (
          <div className="no-results">
            <h3>No vectors found</h3>
            <p>Try another search or filter.</p>
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
    </section>
  );
}

export default Vectors;