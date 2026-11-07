import "./Icons.css";
import { useState } from "react";
import "../../components/Footer.css";
import Breadcrumb from "../../components/Breadcrumb";
import IconModal from "../../components/IconModal";

// trial icons uploaded to public/; replaced by real assets later
const sampleIcons = [
  { name: "Barcode", src: "/barcode.svg", style: "outline", tags: ["barcode", "scan", "product", "price", "shopping"] },
  { name: "Hot sale", src: "/hot%20sale.svg", style: "outline", tags: ["sale", "discount", "fire", "promotion", "shopping"] },
  { name: "Pin", src: "/pin.svg", style: "outline", tags: ["pin", "location", "map", "marker", "navigation"] },
  { name: "Promo", src: "/promo.svg", style: "outline", tags: ["promo", "tag", "discount", "label", "offer"] },
  { name: "Cashier", src: "/cashier.svg", style: "flat", tags: ["cashier", "store", "payment", "shop", "checkout"] },
  { name: "E-commerce", src: "/ecommerce.svg", style: "glyph", tags: ["ecommerce", "online shop", "cart", "website", "shopping"] },
  { name: "Wallet", src: "/wallet%20icon.svg", style: "glyph", tags: ["wallet", "money", "payment", "finance", "cash"] },
  { name: "Coupon", src: "/coupon%202.svg", style: "gradient", tags: ["coupon", "voucher", "discount", "ticket", "sale"] },
  { name: "Discount", src: "/discount.svg", style: "gradient", tags: ["discount", "percent", "badge", "sale", "offer"] },
];

const totalAssets = 200;

const icons = Array.from({ length: totalAssets }, (_, index) => {
  const sample = sampleIcons[index % sampleIcons.length];
  return {
    id: index + 1,
    code: `KD-IC-${String(100000 + index * 11).padStart(6, "0")}`,
    name: sample.name,
    image: sample.src,
    keywords: [...sample.tags, "icon", sample.style],
    category: ["business", "social", "ui", "holiday", "nature"][index % 5],
    style: sample.style,
    type: index % 4 === 0 ? "set" : "icon",
    price: index % 3 === 0 ? "paid" : "free",
    license: index % 3 === 0 ? "premium" : "free",
  };
});

function Icons({ setPage, initialSearch = "" }) {
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

  const itemsPerPage = 40;

  const q = search.toLowerCase();

  const filteredIcons = icons.filter((icon) => {
    const matchSearch =
      icon.name.toLowerCase().includes(q) ||
      // match from the start of a word, so "pin" doesn't find "shopping"
      icon.keywords.some((k) => k.split(" ").some((word) => word.startsWith(q)));

    const matchCategory =
      category === "all" || icon.category === category;

    const matchStyle =
      style === "all" || icon.style === style;

    const matchType =
      type === "all" || icon.type === type;

    const matchPrice =
      price === "all" || icon.price === price;

    return (
      matchSearch &&
      matchCategory &&
      matchStyle &&
      matchType &&
      matchPrice
    );
  });

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
    setSearch(tag);
    setCurrentPage(1);
  };

  // one of each other trial icon; later, icons from the same set or style
  const related = selected
    ? sampleIcons
        .filter((s) => s.src !== selected.image)
        .map((s) => icons.find((i) => i.image === s.src))
    : [];

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
                {category === "all"
                  ? "All Icons"
                  : `${category} Icons`}
              </h2>

              <p>
                {filteredIcons.length} assets
              </p>
            </div>

            <span className="page-info">
              Page {currentPage} / {totalPages}
            </span>

          </div>


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
                  onClick={() => setSelected(icon)}
                  onKeyDown={(e) => e.key === "Enter" && setSelected(icon)}
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

        </main>

      </div>

      {selected && (
        <IconModal
          key={selected.id}
          icon={selected}
          related={related}
          onSelect={setSelected}
          onTag={searchTag}
          onClose={() => setSelected(null)}
        />
      )}

    </section>
  );
}

export default Icons;