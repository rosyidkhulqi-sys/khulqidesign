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
import { searchCatalog, toLogo } from "../../lib/catalog";

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
  // the page of logos the database found, and how many there are in all
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [related, setRelated] = useState([]);

  const perPage = 24;

  const reset = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  // asks the database again whenever the search, a filter or the page
  // changes; a logo's code (KD-LG-…) finds that logo
  useEffect(() => {
    let alive = true;
    const code = search.trim().match(/^kd-?lg-?\d+$/i);
    const timer = setTimeout(() => {
      searchCatalog("logo", {
        text: code ? "" : search,
        kindWords: ["logo", "logos"],
        sort,
        page: currentPage,
        perPage,
        narrow: (query) => {
          if (code) query = query.ilike("code", `%${search.trim().replace(/[^a-z0-9-]/gi, "")}%`);
          if (license !== "all") query = query.eq("license", license);
          if (industry !== "all") query = query.eq("industry", industry);
          if (style !== "all") query = query.eq("style", style);
          if (hideSold) query = query.is("sold_at", null);
          return query;
        },
      })
        .then(({ rows, total: count }) => {
          if (!alive) return;
          setItems(rows.map(toLogo));
          setTotal(count);
        })
        .catch(() => {
          /* the page shows its empty state if the catalogue can't be reached */
        });
    }, search ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, license, industry, style, hideSold, sort, currentPage]);

  // the same industry first, then the same style from other industries
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    Promise.all([
      searchCatalog("logo", { perPage: 7, narrow: (query) => query.eq("industry", selected.industry) }),
      searchCatalog("logo", { perPage: 6, narrow: (query) => query.eq("style", selected.style).neq("industry", selected.industry) }),
    ])
      .then(([same, alike]) => {
        if (!alive) return;
        const list = [...same.rows, ...alike.rows].map(toLogo).filter((l) => l.code !== selected.code);
        setRelated(list.slice(0, 6));
      })
      .catch(() => alive && setRelated([]));
    return () => {
      alive = false;
    };
  }, [selected]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

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
          Logos <span className="library-count">{total} {total === 1 ? "logo" : "logos"}</span>
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

export default Logos;
