import { useEffect, useState } from "react";
import TemplateThumb from "../../components/TemplateThumb";
import { fetchTemplates } from "../create/templatePublish";
import "../vectors/Vectors.css";
import "./Templates.css";
import Breadcrumb from "../../components/Breadcrumb";
import AiSearchButton from "../../components/AiSearchButton";
import { matchesSearch } from "../../lib/search";
import SkeletonCards from "../../components/SkeletonCards";
import LibrarySwitch from "../../components/LibrarySwitch";

// the width in pixels of a template picture made `longSide` on its longer edge
const pxWide = (t, longSide) => Math.round(t.w * Math.min(1, longSide / Math.max(t.w, t.h)));

function Templates({ setPage, onCustomize, initialSearch = "" }) {
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState("all");
  const [orientation, setOrientation] = useState("all");
  const [license, setLicense] = useState("all");
  const [sort, setSort] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);

  // templates published from Create, newest first, ahead of the built-in ones
  const [published, setPublished] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetchTemplates()
      .then((list) => alive && setPublished(list))
      .catch(() => {
        /* the list stays empty until the catalog loads */
      })
      .finally(() => alive && setCatalogLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  // every template is a published one: built in Create and kept in the catalog
  const allTemplates = published;
  const templateCategories = [...new Set(published.map((t) => t.category))];

  const perPage = 24;

  const reset = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const q = search.toLowerCase();
  const filtered = allTemplates
    .filter((t) => matchesSearch(q, (term) => t.title.includes(term) || t.keywords.some((k) => k.includes(term)),
      ["template", "templates"]))
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
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="Templates" />
        {/* the count sits by the title, so results start higher */}
        <h1>
          Templates {!catalogLoading && <span className="library-count">{filtered.length} {filtered.length === 1 ? "template" : "templates"}</span>}
        </h1>
      </div>

      {/* SEARCH */}
      <div className="icon-search">
        <LibrarySwitch current="templates" search={search} setPage={setPage} />
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
        <AiSearchButton example="Instagram post for a coffee shop promo" />
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

      {/* GRID */}
      <div className="vector-grid is-bare">
        {catalogLoading ? <SkeletonCards count={12} cardClass="vector-card" ratios={["1 / 1", "4 / 5", "9 / 16", "16 / 9"]} /> : items.length > 0 ? (
          items.map((t) => (
            <div className="vector-card template-card" key={t.dbId ?? t.id} onClick={() => onCustomize(t)}>
              <div className="vector-thumb" style={{ aspectRatio: `${t.w} / ${t.h}` }}>
                {t.scene ? (
                  <TemplateThumb scene={t.scene} />
                ) : (
                  // the 600 px thumb is soft on Retina screens and in wide
                  // cards: the browser takes the 1400 px preview there
                  <img
                    src={t.image}
                    srcSet={t.previewImage ? `${t.image} ${pxWide(t, 600)}w, ${t.previewImage} ${pxWide(t, 1400)}w` : undefined}
                    sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw"
                    alt={t.title}
                    loading="lazy"
                  />
                )}
                <span className={`vector-badge ${t.license}`}>
                  {t.license === "free" ? "Free" : "Premium"}
                </span>
                <span className="vector-format">{t.w}×{t.h}</span>
                <button className="template-edit">Customize in Create</button>
              </div>
              {/* pictures only, as on Vectors; the title is the alt text */}
            </div>
          ))
        ) : (
          <div className="no-results">
            <h3>No templates found</h3>
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
    </section>
  );
}

export default Templates;
