// Logos: ready-made logos for brand identity. Free to draw visitors in,
// Premium (non-exclusive, with the subscription) and Exclusive (bought
// outright by one buyer, then marked sold). A card opens LogoModal.
import { useEffect, useState } from "react";
import "../vectors/Vectors.css";
import "./Logos.css";
import Breadcrumb from "../../components/Breadcrumb";
import AiSearchButton from "../../components/AiSearchButton";
import LogoModal from "./LogoModal";
import { industries, industryName, logoStyles } from "../../data/logosData";
import { fetchPublished, toLogo } from "../../lib/catalog";
import { matchesSearch } from "../../lib/search";

const licenseLabel = { free: "Free", premium: "Premium", exclusive: "Exclusive" };

function LogoCard({ logo, onOpen }) {
  const { license, price, sold } = logo;
  return (
    <div
      className={`logo-card ${sold ? "is-sold" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${logo.title} logo`}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      <div className="logo-thumb">
        <img src={logo.image} alt={logo.title} loading="lazy" />
        <span className={`vector-badge ${license}`}>{licenseLabel[license]}</span>
        {sold && <span className="logo-sold">Sold</span>}
      </div>
      <div className="logo-info">
        <div>
          <p className="vector-name">{logo.title}</p>
          <p className="logo-industry">{industryName[logo.industry]}</p>
        </div>
        {license === "exclusive" && (
          <span className="logo-price">{sold ? "Sold" : `$${price}`}</span>
        )}
      </div>
    </div>
  );
}

function Logos({ setPage, initialSearch = "", user = null }) {
  const [search, setSearch] = useState(initialSearch);
  const [license, setLicense] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [style, setStyle] = useState("all");
  const [hideSold, setHideSold] = useState(false);
  const [sort, setSort] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  // logos uploaded through /admin, newest first
  const [uploaded, setUploaded] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchPublished("logo")
      .then((rows) => alive && setUploaded(rows.map(toLogo)))
      .catch(() => {
        /* the page shows its empty state if the catalogue can't be reached */
      });
    return () => {
      alive = false;
    };
  }, []);
  const allLogos = uploaded;

  const perPage = 24;

  const reset = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const q = search.toLowerCase();
  const filtered = allLogos
    .filter((l) => matchesSearch(q, (term) =>
      l.title.toLowerCase().includes(term) ||
      l.code.toLowerCase().includes(term) ||
      l.searchText.includes(term) ||
      l.keywords.some((k) => k.startsWith(term) || k.split(" ").some((word) => word.startsWith(term)))
    , ["logo", "logos"]))
    .filter((l) => license === "all" || l.license === license)
    .filter((l) => industry === "all" || l.industry === industry)
    .filter((l) => style === "all" || l.style === style)
    .filter((l) => !hideSold || !l.sold)
    .sort((a, b) =>
      sort === "popular" ? b.downloads - a.downloads : b.id - a.id
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const items = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const clearFilters = () => {
    setLicense("all");
    setIndustry("all");
    setStyle("all");
    setHideSold(false);
    setSort("popular");
    setSearch("");
    setCurrentPage(1);
  };

  const hasFilter =
    license !== "all" || industry !== "all" || style !== "all" || hideSold || search;

  const searchTag = (tag) => {
    setSelected(null);
    setSearch(tag);
    setCurrentPage(1);
  };

  return (
    <section className="vectors-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="Logos" />
        <h1>
          Logos <span className="library-count">{filtered.length} {filtered.length === 1 ? "logo" : "logos"}</span>
        </h1>
      </div>

      {/* SEARCH */}
      <div className="icon-search">
        <select className="search-type" value="logos" onChange={() => {}}>
          <option value="logos">Logos</option>
        </select>
        <input
          type="text"
          placeholder="Search logos, coffee, barber, monogram, mascot..."
          value={search}
          onChange={reset(setSearch)}
        />
        {search && (
          <button className="clear-search" onClick={() => setSearch("")}>
            ×
          </button>
        )}
        <AiSearchButton example="a modern monogram logo for a coffee shop" />
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
        <select value={license} onChange={reset(setLicense)} aria-label="License">
          <option value="all">License</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
          <option value="exclusive">Exclusive</option>
        </select>

        <select value={industry} onChange={reset(setIndustry)} aria-label="Industry">
          <option value="all">Industry</option>
          {industries.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>

        <select value={style} onChange={reset(setStyle)} aria-label="Style">
          <option value="all">Style</option>
          {logoStyles.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>

        <label className="logo-toggle">
          <input
            type="checkbox"
            checked={hideSold}
            onChange={(e) => {
              setHideSold(e.target.checked);
              setCurrentPage(1);
            }}
          />
          Hide sold
        </label>

        {hasFilter && (
          <button className="clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        )}

        <div className="vector-sort">
          <select value={sort} onChange={reset(setSort)} aria-label="Sort">
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* what the three licenses mean, in one line */}
      <p className="logo-licenses">
        <span><b className="free">Free</b> download with credit</span>
        <span><b className="premium">Premium</b> included with a subscription, non-exclusive</span>
        <span><b className="exclusive">Exclusive</b> buy it once, it's yours alone</span>
      </p>

      {/* GRID */}
      <div className="logo-grid">
        {items.length > 0 ? (
          items.map((l) => <LogoCard key={l.id} logo={l} onOpen={() => setSelected(l)} />)
        ) : (
          <div className="no-results">
            <h3>No logos found</h3>
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
        <LogoModal
          key={selected.id}
          logo={selected}
          related={allLogos
            .filter((l) => l.industry === selected.industry && l.id !== selected.id)
            .concat(allLogos.filter((l) => l.style === selected.style && l.industry !== selected.industry))
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

export default Logos;
