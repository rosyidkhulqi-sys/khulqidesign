// A stock library page (Photos, Mockups): search, filters, a grid of
// pictures in their own shape and the asset view with downloads, the same
// pattern as Vectors. Each library passes its own words and options.
import { useEffect, useState } from "react";
import "../vectors/Vectors.css";
import AssetModal from "../../components/AssetModal";
import Breadcrumb from "../../components/Breadcrumb";
import AiSearchButton from "../../components/AiSearchButton";
import { ToolGlyph } from "../../components/IconControls";
import SkeletonCards from "../../components/SkeletonCards";
import { fetchAssetByCode, searchCatalog, toStock } from "../../lib/catalog";
import { useAssetUrl } from "../../lib/useAssetUrl";
import { stockCategoryLabel } from "../../data/stockCategories";

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const PER_PAGE = 24;

// config: { type, page, title, noun: [one, many], kindWords, placeholder,
//   aiExample, categories: [[id, label]], options(asset), specs(asset),
//   empty: { title, text } }
function StockLibrary({ config, setPage, initialSearch = "", user = null }) {
  const { type, page, title, noun, kindWords, categories } = config;
  const [search, setSearch] = useState(initialSearch);
  const [license, setLicense] = useState("all");
  const [orientation, setOrientation] = useState("all");
  const [category, setCategory] = useState("all");
  // AI-generated: all, only AI, or without AI (as Magnific's filter)
  const [ai, setAi] = useState("all");
  // usage: commercial use, or editorial use only (as Adobe Stock's filter)
  const [usage, setUsage] = useState("all");
  const [sort, setSort] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  useAssetUrl(page, selected, setSelected, (code) => fetchAssetByCode(type, code).then((row) => row && toStock(row)));
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [related, setRelated] = useState([]);

  const reset = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      searchCatalog(type, {
        text: search,
        kindWords,
        sort,
        page: currentPage,
        perPage: PER_PAGE,
        narrow: (query) => {
          if (license !== "all") query = query.eq("license", license);
          if (orientation !== "all") query = query.eq("orientation", orientation);
          if (category !== "all") query = query.eq("category", category);
          if (ai !== "all") query = query.eq("ai_generated", ai === "only");
          if (usage !== "all") query = query.eq("editorial", usage === "editorial");
          return query;
        },
      })
        .then(({ rows, total: count }) => {
          if (!alive) return;
          setItems(rows.map(toStock));
          setTotal(count);
          setError(null);
        })
        .catch((e) => alive && setError(e.message || `${title} could not be loaded.`))
        .finally(() => alive && setLoading(false));
    }, search ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [type, title, kindWords, search, license, orientation, category, ai, usage, sort, currentPage]);

  // more from the same category, for the asset view
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    searchCatalog(type, { perPage: 7, narrow: (query) => query.eq("category", selected.category) })
      .then(({ rows }) => alive && setRelated(rows.map(toStock).filter((v) => v.code !== selected.code).slice(0, 6)))
      .catch(() => alive && setRelated([]));
    return () => {
      alive = false;
    };
  }, [type, selected]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hasFilter = license !== "all" || orientation !== "all" || category !== "all" || ai !== "all" || usage !== "all" || search;
  const clearFilters = () => {
    setLicense("all");
    setOrientation("all");
    setCategory("all");
    setAi("all");
    setUsage("all");
    setSort("popular");
    setSearch("");
    setCurrentPage(1);
  };
  const searchTag = (tag) => {
    setSelected(null);
    setSearch(tag);
    setCurrentPage(1);
  };

  return (
    <section className="vectors-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current={title} />
        <h1>
          {title} {!loading && <span className="library-count">{total} {total === 1 ? noun[0] : noun[1]}</span>}
        </h1>
      </div>

      <div className="icon-search">
        <select className="search-type" value={page} onChange={() => {}}>
          <option value={page}>{title}</option>
        </select>
        <input type="text" placeholder={config.placeholder} value={search} onChange={reset(setSearch)} />
        {search && (
          <button className="clear-search" onClick={() => setSearch("")} aria-label="Clear search">×</button>
        )}
        <AiSearchButton example={config.aiExample} />
        <button className="search-submit" aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </button>
      </div>

      <div className="vector-filters">
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
          {categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={ai} onChange={reset(setAi)} aria-label="AI-generated">
          <option value="all">AI-generated</option>
          <option value="only">Only AI</option>
          <option value="none">Exclude AI</option>
        </select>
        {type === "photo" && (
          <select value={usage} onChange={reset(setUsage)} aria-label="Usage">
            <option value="all">Usage</option>
            <option value="commercial">Commercial use</option>
            <option value="editorial">Editorial use only</option>
          </select>
        )}
        {hasFilter && <button className="clear-filters" onClick={clearFilters}>Clear filters</button>}
        <div className="vector-sort">
          <select value={sort} onChange={reset(setSort)}>
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {error && <p className="no-results" role="alert">{error}</p>}

      <div className="vector-grid is-bare">
        {loading ? <SkeletonCards count={12} cardClass="vector-card" ratios={["4 / 3", "3 / 4", "16 / 9", "1 / 1"]} /> : items.length > 0 ? (
          items.map((v) => (
            <div className="vector-card" key={v.code ?? v.id} role="button" tabIndex={0} aria-label={v.title}
                 onClick={() => setSelected(v)} onKeyDown={(e) => e.key === "Enter" && setSelected(v)}>
              <div className={`vector-thumb ${v.format === "PNG" ? "is-transparent" : ""}`} style={{ aspectRatio: `${v.artboard[0]} / ${v.artboard[1]}` }}>
                <img src={v.image} alt={v.title} loading="lazy" />
                {/* one badge, as microstocks show it: Free, Premium or Editorial */}
                <span className={`vector-badge ${v.editorial ? "editorial" : v.license}`}>
                  {v.editorial ? "Editorial" : v.license === "free" ? "Free" : "Premium"}
                </span>
                <span className="vector-format">
                  {v.format}
                  {v.ai && <span className="vector-ai" title="Made with generative AI">AI</span>}
                </span>
                <div className="vector-actions" onClick={(e) => e.stopPropagation()}>
                  <button aria-label="Save"><ToolGlyph name="heart" size={16} /></button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-results">
            {/* a library still being filled says so, instead of "nothing found" */}
            <h3>{hasFilter ? `No ${noun[1]} found` : config.empty.title}</h3>
            <p>{hasFilter ? "Try another search or filter." : config.empty.text}</p>
            {hasFilter && <button className="clear-filters" onClick={clearFilters}>Clear filters</button>}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-arrow" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
            .map((p) => (
              <button key={p} className={`page-number ${currentPage === p ? "active" : ""}`} onClick={() => setCurrentPage(p)}>{p}</button>
            ))}
          <button className="page-arrow" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>›</button>
        </div>
      )}

      {selected && (
        <AssetModal
          key={selected.code ?? selected.id}
          asset={selected}
          kind={type}
          options={config.options(selected)}
          specs={[
            ["File ID", selected.code],
            ...config.specs(selected),
            ["Orientation", capitalize(selected.orientation)],
            ["Category", stockCategoryLabel(selected.category)],
            ...(selected.ai ? [["AI-generated", "Yes · fictional people, places and products"]] : []),
            ...(selected.editorial ? [["Usage", "Editorial use only · articles, blogs, education; not ads, packaging or merchandise"]] : []),
          ]}
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

export default StockLibrary;
