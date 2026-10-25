import { useState } from "react";
import PageHeader from "./PageHeader";
import TemplateThumb from "./TemplateThumb";
import { allTemplates, templateCategories } from "./templatesData";
import "./Vectors.css";
import "./Templates.css";

function Templates({ setPage, onCustomize }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [orientation, setOrientation] = useState("all");
  const [license, setLicense] = useState("all");
  const [sort, setSort] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);

  const perPage = 24;

  const reset = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const q = search.toLowerCase();
  const filtered = allTemplates
    .filter((t) => t.title.includes(q) || t.keywords.some((k) => k.includes(q)))
    .filter((t) => category === "all" || t.category === category)
    .filter((t) => orientation === "all" || t.orientation === orientation)
    .filter((t) => license === "all" || t.license === license)
    .sort((a, b) =>
      sort === "popular" ? b.downloads - a.downloads : b.id - a.id
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const items = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const clearFilters = () => {
    setCategory("all");
    setOrientation("all");
    setLicense("all");
    setSort("popular");
    setSearch("");
    setCurrentPage(1);
  };

  const hasFilter =
    category !== "all" || orientation !== "all" || license !== "all" || search;

  return (
    <section className="vectors-page">
      <PageHeader page="templates" setPage={setPage} />

      {/* SEARCH */}
      <div className="icon-search">
        <select className="search-type" value="templates" onChange={() => {}}>
          <option value="templates">Templates</option>
        </select>
        <input
          type="text"
          placeholder="Search templates, social media, poster, presentation..."
          value={search}
          onChange={reset(setSearch)}
        />
        {search && (
          <button className="clear-search" onClick={() => setSearch("")}>
            ×
          </button>
        )}
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
        <select value={category} onChange={reset(setCategory)}>
          <option value="all">Category</option>
          {templateCategories.map((c) => (
            <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
          ))}
        </select>

        <select value={orientation} onChange={reset(setOrientation)}>
          <option value="all">Orientation</option>
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
          <option value="square">Square</option>
        </select>

        <select value={license} onChange={reset(setLicense)}>
          <option value="all">License</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
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

      <p className="vector-count">{filtered.length} templates</p>

      {/* GRID */}
      <div className="vector-grid">
        {items.length > 0 ? (
          items.map((t) => (
            <div className="vector-card template-card" key={t.id} onClick={() => onCustomize(t)}>
              <div className="vector-thumb" style={{ aspectRatio: `${t.w} / ${t.h}` }}>
                <TemplateThumb scene={t.scene} />
                <span className={`vector-badge ${t.license}`}>
                  {t.license === "free" ? "Free" : "Premium"}
                </span>
                <span className="vector-format">{t.w}×{t.h}</span>
                <button className="template-edit">Customize in Create</button>
              </div>
              <p className="vector-name">{t.title}</p>
            </div>
          ))
        ) : (
          <div className="no-results">
            <h3>No templates found</h3>
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

export default Templates;
