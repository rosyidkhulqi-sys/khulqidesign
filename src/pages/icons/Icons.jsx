import "./Icons.css";
import { useState } from "react";
import "../../components/Footer.css";
import Breadcrumb from "../../components/Breadcrumb";
import IconModal from "../../components/IconModal";
import IconSetView, { SetCard } from "./IconSets";
import { icons, iconSets, membersOf, setOf } from "../../data/iconsData";

// the price filter's "paid" means a Premium license
const matchesPrice = (price, license) =>
  price === "all" || (price === "paid" ? license === "premium" : license === "free");

const wordStarts = (keywords, q) =>
  keywords.some((k) => k.split(" ").some((word) => word.startsWith(q)));

function Icons({ setPage, initialSearch = "", user = null }) {
  const [search, setSearch] = useState(initialSearch);

  const [category, setCategory] = useState("all");
  const [style, setStyle] = useState("all");
  const [type, setType] = useState("all");
  const [price, setPrice] = useState("all");

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [openCategory, setOpenCategory] = useState(true);
  const [openStyle, setOpenStyle] = useState(false);
  const [openType, setOpenType] = useState(false);
  const [openPrice, setOpenPrice] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  // color and size an icon opens with when picked from a customized set
  const [openWith, setOpenWith] = useState(null);
  // the icon set page shown in place of the library, or null
  const [openSet, setOpenSet] = useState(null);

  const itemsPerPage = 40;
  const showSets = type === "set";

  const q = search.toLowerCase();

  const filteredIcons = icons.filter((icon) => {
    const matchSearch =
      icon.name.toLowerCase().includes(q) ||
      // match from the start of a word, so "pin" doesn't find "shopping"
      wordStarts(icon.keywords, q);

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
  });

  // sets match on their name or on any of their icons
  const filteredSets = iconSets.filter(
    (set) =>
      (set.name.toLowerCase().includes(q) ||
        membersOf(set).some((icon) => wordStarts(icon.keywords, q))) &&
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

  const toggleSection = (section) => {
    if (section === "category") {
      setOpenCategory(!openCategory);
    }

    if (section === "style") {
      setOpenStyle(!openStyle);
    }

    if (section === "type") {
      setOpenType(!openType);
    }

    if (section === "price") {
      setOpenPrice(!openPrice);
    }
  };

  const changeFilter = (setter, value) => {
    setter(value);
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
      <Breadcrumb setPage={setPage} current="Icons" />


     {/* SEARCH */}
<div className="icon-search">
  <select
    className="search-type"
    value={type}
    onChange={(e) => changeFilter(setType, e.target.value)}
  >
    <option value="all">All</option>
    <option value="icon">Icon</option>
    <option value="set">Icon Set</option>
  </select>

  <input
    type="text"
    placeholder="Search icons, sets, business, social, UI..."
    value={search}
    onChange={(e) => {
      setSearch(e.target.value);
      setCurrentPage(1);
    }}
  />

  {search && (
    <button
      className="clear-search"
      onClick={() => {
        setSearch("");
        setCurrentPage(1);
      }}
    >
      ×
    </button>
  )}

  <button className="search-submit" aria-label="Search">
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  </button>
</div>


      {/* MAIN CONTENT */}
      <div
        className={`icons-layout ${
          sidebarOpen ? "sidebar-open" : "sidebar-closed"
        }`}
      >

        {/* SIDEBAR */}
        <aside className="icon-sidebar">

          <div className="sidebar-top">
            {sidebarOpen && <strong>FILTER</strong>}

            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? "‹" : "›"}
            </button>
          </div>


          {sidebarOpen && (
            <div className="filter-content">

              {/* CATEGORY */}
              <div className="filter-section">

                <button
                  className="filter-title"
                  onClick={() => toggleSection("category")}
                >
                  <span>Category</span>
                  <span>{openCategory ? "−" : "+"}</span>
                </button>

                {openCategory && (
                  <div className="filter-options">

                    <button
                      className={category === "all" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setCategory, "all")
                      }
                    >
                      All
                    </button>

                    <button
                      className={category === "business" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setCategory, "business")
                      }
                    >
                      Business
                    </button>

                    <button
                      className={category === "social" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setCategory, "social")
                      }
                    >
                      Social
                    </button>

                    <button
                      className={category === "ui" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setCategory, "ui")
                      }
                    >
                      UI
                    </button>

                    <button
                      className={category === "holiday" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setCategory, "holiday")
                      }
                    >
                      Holiday
                    </button>

                    <button
                      className={category === "nature" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setCategory, "nature")
                      }
                    >
                      Nature
                    </button>

                  </div>
                )}
              </div>


              {/* STYLE */}
              <div className="filter-section">

                <button
                  className="filter-title"
                  onClick={() => toggleSection("style")}
                >
                  <span>Style</span>
                  <span>{openStyle ? "−" : "+"}</span>
                </button>

                {openStyle && (
                  <div className="filter-options">

                    <button
                      className={style === "all" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setStyle, "all")
                      }
                    >
                      All
                    </button>

                    <button
                      className={style === "outline" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setStyle, "outline")
                      }
                    >
                      Outline
                    </button>

                    <button
                      className={style === "glyph" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setStyle, "glyph")
                      }
                    >
                      Glyph
                    </button>

                    <button
                      className={style === "flat" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setStyle, "flat")
                      }
                    >
                      Flat
                    </button>

                    <button
                      className={style === "gradient" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setStyle, "gradient")
                      }
                    >
                      Gradient
                    </button>

                  </div>
                )}
              </div>

  
              {/* PRICE */}
              <div className="filter-section">

                <button
                  className="filter-title"
                  onClick={() => toggleSection("price")}
                >
                  <span>Price</span>
                  <span>{openPrice ? "−" : "+"}</span>
                </button>

                {openPrice && (
                  <div className="filter-options">

                    <button
                      className={price === "all" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setPrice, "all")
                      }
                    >
                      All
                    </button>

                    <button
                      className={price === "free" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setPrice, "free")
                      }
                    >
                      Free
                    </button>

                    <button
                      className={price === "paid" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setPrice, "paid")
                      }
                    >
                      Paid
                    </button>

                  </div>
                )}
              </div>

            </div>
          )}

        </aside>


        {/* RESULTS */}
        <main className="icons-results">

          <div className="results-header">

            <div>
              <h2>
                {showSets
                  ? "Icon Sets"
                  : category === "all"
                    ? "All Icons"
                    : `${category} Icons`}
              </h2>

              <p>
                {showSets
                  ? `${filteredSets.length} sets`
                  : `${filteredIcons.length} assets`}
              </p>
            </div>

            {!showSets && (
              <span className="page-info">
                Page {currentPage} / {totalPages}
              </span>
            )}

          </div>


          {/* SET GRID — Type: Icon Set */}
          {showSets ? (
            <div className="set-grid">
              {filteredSets.length > 0 ? (
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
                </div>
              )}
            </div>
          ) : (
          <>

          {/* ICON GRID */}
          <div className="results-grid">

            {currentIcons.length > 0 ? (
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

                    <img
                      src={icon.image}
                      alt=""
                      className="small-icon"
                    />

                    <div className="icon-actions" onClick={(e) => e.stopPropagation()}>
                      <button aria-label="Save">♡</button>
                      <button aria-label="Add to collection">+</button>
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
                <p>
                  Try another search or filter.
                </p>
              </div>
            )}

          </div>


          {/* PAGINATION */}
          <div className="pagination">

            <button
              className="page-arrow"
              onClick={() =>
                setCurrentPage(
                  Math.max(1, currentPage - 1)
                )
              }
              disabled={currentPage === 1}
            >
              ‹
            </button>


            {Array.from(
              { length: totalPages },
              (_, index) => index + 1
            )
              .slice(
                Math.max(0, currentPage - 3),
                Math.min(totalPages, currentPage + 2)
              )
              .map((page) => (
                <button
                  key={page}
                  className={`page-number ${
                    currentPage === page ? "active" : ""
                  }`}
                  onClick={() =>
                    setCurrentPage(page)
                  }
                >
                  {page}
                </button>
              ))}


            <button
              className="page-arrow"
              onClick={() =>
                setCurrentPage(
                  Math.min(totalPages, currentPage + 1)
                )
              }
              disabled={currentPage === totalPages}
            >
              ›
            </button>

          </div>

          </>
          )}

        </main>

      </div>

      {modal}

    </section>
  );
}

export default Icons;