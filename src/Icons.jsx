import { useState } from "react";
import "./Icons.css";
import "./Footer.css";

function Icons({ setPage }) {
  const [search, setSearch] = useState("");

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

  const itemsPerPage = 40;
  const totalAssets = 200;
  const totalPages = Math.ceil(totalAssets / itemsPerPage);

  const icons = Array.from({ length: totalAssets }, (_, index) => ({
    id: index + 1,
    name: `Icon ${index + 1}`,
    category: ["business", "social", "ui", "holiday", "nature"][index % 5],
    style: ["outline", "glyph", "filled", "flat", "gradient"][index % 5],
    type: index % 4 === 0 ? "set" : "icon",
    price: index % 3 === 0 ? "paid" : "free",
  }));

  const filteredIcons = icons.filter((icon) => {
    const matchSearch =
      icon.name.toLowerCase().includes(search.toLowerCase());

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

  return (
    <section className="icons-page">

      {/* HEADER */}
      <div className="icons-header">
        <div>
          <h1>Icons Library</h1>
          <p>
            {search
              ? `Search results for "${search}"`
              : "Explore our icon collection"}
          </p>
        </div>

        <button
          className="back-btn"
          onClick={() => setPage("home")}
        >
          Back Home
        </button>
      </div>


      {/* SEARCH */}
      <div className="icon-search">
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
                      className={style === "filled" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setStyle, "filled")
                      }
                    >
                      Filled
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


              {/* TYPE */}
              <div className="filter-section">

                <button
                  className="filter-title"
                  onClick={() => toggleSection("type")}
                >
                  <span>Type</span>
                  <span>{openType ? "−" : "+"}</span>
                </button>

                {openType && (
                  <div className="filter-options">

                    <button
                      className={type === "all" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setType, "all")
                      }
                    >
                      All
                    </button>

                    <button
                      className={type === "icon" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setType, "icon")
                      }
                    >
                      Icon
                    </button>

                    <button
                      className={type === "set" ? "selected" : ""}
                      onClick={() =>
                        changeFilter(setType, "set")
                      }
                    >
                      Icon Set
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
                >

                  <div className="icon-preview">

                    <img
                      src="/preview1.jpg"
                      alt={icon.name}
                      className="small-icon"
                    />

                    <div className="icon-actions">
                      <button>♡</button>
                      <button>+</button>
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

    </section>
  );
}

export default Icons;