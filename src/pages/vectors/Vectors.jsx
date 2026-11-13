import { useEffect, useState } from "react";
import "./Vectors.css";
import AssetModal from "../../components/AssetModal";
import Breadcrumb from "../../components/Breadcrumb";
import AiSearchButton from "../../components/AiSearchButton";
import { ToolGlyph } from "../../components/IconControls";
import { searchCatalog, toVector } from "../../lib/catalog";
import { VECTOR_CATEGORY_OPTIONS, vectorCategoryLabel, vectorCategoryStorageValues } from "../../data/vectorCategories";

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
    ["Category", vectorCategoryLabel(v.category)],
    ["Release", "Not required"],
  ];
}

function Vectors({ setPage, initialSearch = "", user = null }) {
  const [search, setSearch] = useState(initialSearch);
  const [format, setFormat] = useState("all");
  const [license, setLicense] = useState("all");
  const [orientation, setOrientation] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  // the page of vectors the database found, and how many there are in all
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [related, setRelated] = useState([]);

  const perPage = 24;

  const reset = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  // asks the database again whenever the search, a filter or the page
  // changes; waits a moment while typing
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      searchCatalog("vector", {
        text: search,
        kindWords: ["vector", "vectors"],
        sort,
        page: currentPage,
        perPage,
        narrow: (query) => {
          if (format !== "all") query = query.contains("files", [{ format }]);
          if (license !== "all") query = query.eq("license", license);
          if (orientation !== "all") query = query.eq("orientation", orientation);
          if (category !== "all") query = query.in("category", vectorCategoryStorageValues(category));
          return query;
        },
      })
        .then(({ rows, total: count }) => {
          if (!alive) return;
          setItems(rows.map(toVector));
          setTotal(count);
          setCatalogError(null);
        })
        .catch((error) => alive && setCatalogError(error.message || "Vectors could not be loaded."))
        .finally(() => alive && setCatalogLoading(false));
    }, search ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, format, license, orientation, category, sort, currentPage]);

  // more from the same category, for the detail view
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    searchCatalog("vector", {
      perPage: 7,
      narrow: (query) => query.in("category", vectorCategoryStorageValues(selected.category)),
    })
      .then(({ rows }) => alive && setRelated(rows.map(toVector).filter((v) => v.code !== selected.code).slice(0, 6)))
      .catch(() => alive && setRelated([]));
    return () => {
      alive = false;
    };
  }, [selected]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const clearFilters = () => {
    setFormat("all");
    setLicense("all");
    setOrientation("all");
    setCategory("all");
    setSort("popular");
    setSearch("");
    setCurrentPage(1);
  };

  const hasFilter =
    format !== "all" || license !== "all" || orientation !== "all" || category !== "all" || search;

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
          Vectors <span className="library-count">{total} {total === 1 ? "vector" : "vectors"}</span>
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
        {search && (
          <button className="clear-search" onClick={() => setSearch("")} aria-label="Clear search">
            ×
          </button>
        )}
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

        <select value={category} onChange={reset(setCategory)} aria-label="Category">
          <option value="all">Category</option>
          {VECTOR_CATEGORY_OPTIONS.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
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

      {catalogError && <p className="no-results" role="alert">{catalogError}</p>}
      {catalogLoading && <p className="no-results" role="status">Loading vectors…</p>}

      {/* GRID */}
      <div className="vector-grid">
        {catalogLoading ? null : items.length > 0 ? (
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
          related={related}
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
