import "./Icons.css";
import "../vectors/Vectors.css";
import { useEffect, useMemo, useState } from "react";
import "../../components/Footer.css";
import { ToolGlyph } from "../../components/IconControls";
import Breadcrumb from "../../components/Breadcrumb";
import AiSearchButton from "../../components/AiSearchButton";
import IconModal from "../../components/IconModal";
import IconSetView, { SetCard } from "./IconSets";
import { fetchIconCatalog } from "../../lib/catalog";
import { matchesSearch } from "../../lib/search";

// the price filter's "paid" means a Premium license
const matchesPrice = (price, license) =>
  price === "all" || (price === "paid" ? license === "premium" : license === "free");

const wordStarts = (keywords, q) =>
  keywords.some((k) => k.split(" ").some((word) => word.startsWith(q)));

function Icons({ setPage, initialSearch = "", user = null, onAnimate }) {
  const [search, setSearch] = useState(initialSearch);

  const [category, setCategory] = useState("all");
  const [style, setStyle] = useState("all");
  // "icon" lists single icons, "set" lists icon sets
  const [type, setType] = useState("icon");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState("popular");

  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  // color and size an icon opens with when picked from a customized set
  const [openWith, setOpenWith] = useState(null);
  // the icon set page shown in place of the library, or null
  const [openSet, setOpenSet] = useState(null);

  // icons and sets uploaded through /admin
  const [uploaded, setUploaded] = useState({ icons: [], sets: [] });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchIconCatalog()
      .then((catalog) => {
        if (!alive) return;
        setUploaded(catalog);
        setCatalogError(null);
      })
      .catch((error) => alive && setCatalogError(error.message || "Icons could not be loaded."))
      .finally(() => alive && setCatalogLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const { icons, iconSets, membersOf, setOf } = useMemo(() => {
    const allIcons = uploaded.icons;
    const allSets = uploaded.sets;
    const byId = Object.fromEntries(allSets.map((s) => [s.id, s]));
    const uploadedMembers = (set) => uploaded.icons.filter((i) => i.setId === set.id);
    return {
      icons: allIcons,
      iconSets: allSets,
      membersOf: (set) => (set ? uploadedMembers(set) : []),
      setOf: (icon) => byId[icon.setId] ?? null,
    };
  }, [uploaded]);

  const itemsPerPage = 40;
  const showSets = type === "set";

  const q = search.toLowerCase();

  const filteredIcons = icons.filter((icon) => {
    const matchSearch = matchesSearch(q, (term) =>
      icon.name.toLowerCase().includes(term) ||
      // match from the start of a word, so "pin" doesn't find "shopping"
      wordStarts(icon.keywords, term)
    , ["icon", "icons"]);

    const matchCategory =
      category === "all" || icon.category === category;

    const matchStyle =
      style === "all" || icon.style === style;

    return (
      matchSearch &&
      matchCategory &&
      matchStyle &&
      matchesPrice(price, icon.license)
    );
  }).sort((a, b) => (sort === "popular" ? b.downloads - a.downloads : b.id - a.id));

  // sets match on their name or on any of their icons
  const filteredSets = iconSets.filter(
    (set) =>
      matchesSearch(q, (term) =>
        set.name.toLowerCase().includes(term) ||
        membersOf(set).some((icon) => wordStarts(icon.keywords, term))
      , ["icon", "icons", "set", "sets"]) &&
      (style === "all" || set.style === style) &&
      matchesPrice(price, set.license)
  );

  // pages follow the filtered results, not the whole library
  const totalPages = Math.max(1, Math.ceil(filteredIcons.length / itemsPerPage));

  const pageStart = (currentPage - 1) * itemsPerPage;

  const currentIcons = filteredIcons.slice(
    pageStart,
    pageStart + itemsPerPage
  );

  // every filter change starts again from page 1
  const pick = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const hasFilter =
    category !== "all" || style !== "all" || price !== "all" || search;

  const clearFilters = () => {
    setCategory("all");
    setStyle("all");
    setPrice("all");
    setSearch("");
    setCurrentPage(1);
  };

  const searchTag = (tag) => {
    setSelected(null);
    setOpenSet(null);
    setSearch(tag);
    setCurrentPage(1);
  };

  const showSet = (set) => {
    setSelected(null);
    setOpenSet(set);
    window.scrollTo(0, 0);
  };

  // an icon opened from the library starts with the default look
  const openIcon = (icon) => {
    setOpenWith(null);
    setSelected(icon);
  };

  const goAuth = (target) => {
    setSelected(null);
    setPage(target);
    window.scrollTo(0, 0);
  };

  // icons outside this one's set (the set has its own strip); later, icons
  // with a similar subject from the search index
  const related = selected
    ? icons.slice(0, 9).filter((i) => i.setId !== selected.setId).slice(0, 6)
    : [];

  const modal = selected && (
    <IconModal
      key={selected.id}
      icon={selected}
      initialEdits={openWith?.edits}
      initialSize={openWith?.px}
      set={setOf(selected)}
      setMembers={membersOf(setOf(selected))}
      onOpenSet={showSet}
      related={related}
      user={user}
      onAuth={goAuth}
      onSelect={openIcon}
      onTag={searchTag}
      onAnimate={onAnimate}
      onClose={() => setSelected(null)}
    />
  );

  if (openSet) {
    return (
      <section className="icons-page">
        <IconSetView
          key={openSet.id}
          set={openSet}
          members={membersOf(openSet)}
          otherSets={iconSets.filter((s) => s.id !== openSet.id)}
          user={user}
          setPage={setPage}
          onAuth={goAuth}
          onBack={() => setOpenSet(null)}
          onOpenSet={showSet}
          onOpenIcon={(icon, edits, px) => {
            setOpenWith({ edits, px });
            setSelected(icon);
          }}
        />
        {modal}
      </section>
    );
  }

  return (
    <section className="icons-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="Icons" />
        {/* the count sits by the title, so results start higher */}
        <h1>
          Icons{" "}
          <span className="library-count">
            {showSets
              ? `${filteredSets.length} icon ${filteredSets.length === 1 ? "set" : "sets"}`
              : `${filteredIcons.length} ${filteredIcons.length === 1 ? "icon" : "icons"}`}
          </span>
        </h1>
      </div>

      {catalogError && <p className="no-results" role="alert">{catalogError}</p>}
      {catalogLoading && <p className="no-results" role="status">Loading icons…</p>}

      {/* SEARCH */}
      <div className="icon-search">
        {/* what to search: single icons or icon sets */}
        <select className="search-type" value={type} onChange={pick(setType)} aria-label="Show">
          <option value="icon">Icons</option>
          <option value="set">Icon sets</option>
        </select>
        <input
          type="text"
          placeholder="Search icons, sets, business, social, UI..."
          value={search}
          onChange={pick(setSearch)}
        />
        {search && (
          <button className="clear-search" onClick={() => setSearch("")}>
            ×
          </button>
        )}
        <AiSearchButton example="red outline shopping icons" />
        <button className="search-submit" aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </button>
      </div>

      {/* FILTER ROW — the same row as Vectors and Footage */}
      <div className="vector-filters">
        <select value={style} onChange={pick(setStyle)} aria-label="Style">
          <option value="all">Style</option>
          <option value="outline">Outline</option>
          <option value="glyph">Glyph</option>
          <option value="flat">Flat</option>
          <option value="gradient">Gradient</option>
        </select>

        {!showSets && (
          <select value={category} onChange={pick(setCategory)} aria-label="Category">
            <option value="all">Category</option>
            <option value="business">Business</option>
            <option value="social">Social</option>
            <option value="ui">UI</option>
            <option value="holiday">Holiday</option>
            <option value="nature">Nature</option>
          </select>
        )}

        <select value={price} onChange={pick(setPrice)} aria-label="License">
          <option value="all">License</option>
          <option value="free">Free</option>
          <option value="paid">Premium</option>
        </select>

        {hasFilter && (
          <button className="clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        )}

        {!showSets && (
          <div className="vector-sort">
            <select value={sort} onChange={pick(setSort)} aria-label="Sort">
              <option value="popular">Most popular</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        )}
      </div>

      {showSets ? (
        <div className="set-grid">
          {catalogLoading ? null : filteredSets.length > 0 ? (
            filteredSets.map((set) => (
              <SetCard
                key={set.id}
                set={set}
                members={membersOf(set)}
                onOpen={() => showSet(set)}
              />
            ))
          ) : (
            <div className="no-results">
              <h3>No icon sets found</h3>
              <p>Try another search or filter.</p>
              {hasFilter && (
                <button className="clear-filters" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ICON GRID */}
          <div className="results-grid">
            {catalogLoading ? null : currentIcons.length > 0 ? (
              currentIcons.map((icon) => (
                <div
                  className="icon-card"
                  key={icon.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${icon.name} icon`}
                  onClick={() => openIcon(icon)}
                  onKeyDown={(e) => e.key === "Enter" && openIcon(icon)}
                >
                  <div className="icon-preview">
                    <img src={icon.image} alt="" className="small-icon" />

                    <div className="icon-actions" onClick={(e) => e.stopPropagation()}>
                      <button aria-label="Save">
                        <ToolGlyph name="heart" size={15} />
                      </button>
                      <button aria-label="Add to collection">
                        <ToolGlyph name="plus" size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="icon-info">
                    <span>{icon.name}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-results">
                <h3>No icons found</h3>
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
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
              .map((page) => (
                <button
                  key={page}
                  className={`page-number ${currentPage === page ? "active" : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
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
        </>
      )}

      {modal}
    </section>
  );
}

export default Icons;
