import { useState } from "react";
import "./Icons.css";

function Icons({ setPage }) {
  const [search, setSearch] = useState("");

  const [category, setCategory] = useState("all");
  const [style, setStyle] = useState("all");
  const [type, setType] = useState("all");
  const [price, setPrice] = useState("all");
  const [license, setLicense] = useState("all");

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [openCategory, setOpenCategory] = useState(true);
  const [openStyle, setOpenStyle] = useState(false);
  const [openType, setOpenType] = useState(false);
  const [openPrice, setOpenPrice] = useState(false);
  const [openLicense, setOpenLicense] = useState(false);

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

    if (section === "license") {
      setOpenLicense(!openLicense);
    }
  };

  return (
    <div className="container">
      <section className="icons-page">

        {/* HEADER */}
        <div className="icons-header">
          <h1>Icons Library</h1>

          <button
            className="back-btn"
            onClick={() => setPage("home")}
          >
            Back Home
          </button>

          <p>Explore icons, icon sets, and creative assets.</p>
        </div>


        {/* SEARCH */}
        <div className="icon-search">
          <span className="search-icon">⌕</span>

          <input
            type="text"
            placeholder="Search icons, icon sets, business, social, UI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button className="search-btn">
            Search
          </button>
        </div>


        {/* MARKETPLACE AREA */}
        <div
          className={
            sidebarOpen
              ? "icons-marketplace sidebar-open"
              : "icons-marketplace sidebar-collapsed"
          }
        >

          {/* SIDEBAR */}
          <aside className="icon-sidebar">

            {/* SIDEBAR HEADER */}
            <div className="sidebar-header">

              {sidebarOpen && (
                <h2>Filters</h2>
              )}

              <button
                className="sidebar-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle filters"
              >
                {sidebarOpen ? "‹" : "›"}
              </button>

            </div>


            {/* SIDEBAR CONTENT */}
            {sidebarOpen && (
              <div className="sidebar-content">

                {/* CATEGORY */}
                <div className="filter-section">

                  <button
                    className="filter-title"
                    onClick={() => toggleSection("category")}
                  >
                    <span>Category</span>
                    <span>
                      {openCategory ? "−" : "+"}
                    </span>
                  </button>

                  {openCategory && (
                    <div className="filter-options">

                      <button
                        className={
                          category === "all"
                            ? "filter-option active"
                            : "filter-option"
                        }
                        onClick={() => setCategory("all")}
                      >
                        All
                      </button>

                      <button
                        className={
                          category === "business"
                            ? "filter-option active"
                            : "filter-option"
                        }
                        onClick={() => setCategory("business")}
                      >
                        Business
                      </button>

                      <button
                        className={
                          category === "social"
                            ? "filter-option active"
                            : "filter-option"
                        }
                        onClick={() => setCategory("social")}
                      >
                        Social
                      </button>

                      <button
                        className={
                          category === "ui"
                            ? "filter-option active"
                            : "filter-option"
                        }
                        onClick={() => setCategory("ui")}
                      >
                        UI
                      </button>

                      <button
                        className={
                          category === "holiday"
                            ? "filter-option active"
                            : "filter-option"
                        }
                        onClick={() => setCategory("holiday")}
                      >
                        Holiday
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
                    <span>
                      {openStyle ? "−" : "+"}
                    </span>
                  </button>

                  {openStyle && (
                    <div className="filter-options">

                      <button
                        className="filter-option"
                        onClick={() => setStyle("all")}
                      >
                        All
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setStyle("outline")}
                      >
                        Outline
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setStyle("glyph")}
                      >
                        Glyph
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setStyle("filled")}
                      >
                        Filled
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setStyle("flat")}
                      >
                        Flat
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setStyle("gradient")}
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
                    <span>
                      {openType ? "−" : "+"}
                    </span>
                  </button>

                  {openType && (
                    <div className="filter-options">

                      <button
                        className="filter-option"
                        onClick={() => setType("all")}
                      >
                        All
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setType("individual")}
                      >
                        Individual Icon
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setType("set")}
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
                    <span>
                      {openPrice ? "−" : "+"}
                    </span>
                  </button>

                  {openPrice && (
                    <div className="filter-options">

                      <button
                        className="filter-option"
                        onClick={() => setPrice("all")}
                      >
                        All
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setPrice("free")}
                      >
                        Free
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setPrice("paid")}
                      >
                        Paid
                      </button>

                    </div>
                  )}

                </div>


                {/* LICENSE */}
                <div className="filter-section">

                  <button
                    className="filter-title"
                    onClick={() => toggleSection("license")}
                  >
                    <span>License</span>
                    <span>
                      {openLicense ? "−" : "+"}
                    </span>
                  </button>

                  {openLicense && (
                    <div className="filter-options">

                      <button
                        className="filter-option"
                        onClick={() => setLicense("all")}
                      >
                        All
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setLicense("commercial")}
                      >
                        Commercial
                      </button>

                      <button
                        className="filter-option"
                        onClick={() => setLicense("personal")}
                      >
                        Personal
                      </button>

                    </div>
                  )}

                </div>

              </div>
            )}

          </aside>


          {/* RESULTS */}
          <main className="icon-results">

            <div className="results-header">

              <div>
                <h2>
                  {category === "all"
                    ? "All Icons"
                    : `${category} Icons`}
                </h2>

                <p>
                  {search
                    ? `Search results for "${search}"`
                    : "Explore our icon collection"}
                </p>
              </div>

              <span className="result-count">
                40 assets
              </span>

            </div>


            {/* ICON GRID */}
            <div className="icon-grid">

              {[...Array(40)].map((_, index) => (
                <div
                  className="icon-card"
                  key={index}
                >

                  <div className="icon-preview">

                    <img
                      src="/preview1.jpg"
                      alt={`Icon ${index + 1}`}
                      className="small-icon"
                    />

                  </div>

                  <div className="icon-info">
                    <span>
                      Icon {index + 1}
                    </span>
                  </div>

                </div>
              ))}

            </div>

          </main>

        </div>

      </section>
    </div>
  );
}

export default Icons;