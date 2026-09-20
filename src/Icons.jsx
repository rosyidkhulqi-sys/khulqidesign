import { useState } from "react";

function Icons({ setPage }) {
  const [category, setCategory] = useState("all");
  const [style, setStyle] = useState("all");
  const [price, setPrice] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showPrice, setShowPrice] = useState(false);

  const closeAll = () => {
    setShowAll(false);
    setShowStyle(false);
    setShowPrice(false);
  };

  return (
    <div className="container">
      <section className="icons-page">
        <h1>Icons Library</h1>

        <button
          className="back-btn"
          onClick={() => setPage("home")}
        >
          Back Home
        </button>

        <p>All icon assets here</p>

        <div className="main-filter">
          {/* ALL */}
          <div className="filter-box">
            <button
              onClick={() => {
                closeAll();
                setShowAll(!showAll);
              }}
            >
              All
            </button>

            {showAll && (
              <div className="dropdown">
                <button onClick={() => { setStyle("all"); closeAll(); }}>All</button>
                <button onClick={() => { setCategory("business"); closeAll(); }}>Business</button>
                <button onClick={() => { setCategory("social"); closeAll(); }}>Social</button>
                <button onClick={() => { setCategory("ui"); closeAll(); }}>UI</button>
                <button onClick={() => { setCategory("holiday"); closeAll(); }}>Holiday</button>
                <button onClick={() => { setCategory("seticon"); closeAll(); }}>Set Icon</button>
              </div>
            )}
          </div>

          {/* STYLE */}
          <div className="filter-box">
            <button
              onClick={() => {
                closeAll();
                setShowStyle(!showStyle);
              }}
            >
              Style
            </button>

            {showStyle && (
              <div className="dropdown">
                <button onClick={() => { setStyle("outline");  closeAll(); }}>Outline</button>
                <button onClick={() => { setStyle("glyph");    closeAll(); }}>Glyph</button>
                <button onClick={() => { setStyle("solid");    closeAll(); }}>Filled</button>
                <button onClick={() => { setStyle("flat");     closeAll(); }}>Flat</button>
                <button onClick={() => { setStyle("gradient"); closeAll(); }}>Gradient</button>
              </div>
            )}
          </div>

          {/* PRICE */}
          <div className="filter-box">
            <button
              onClick={() => {
                closeAll();
                setShowPrice(!showPrice);
              }}
            >
              Price
            </button>

            {showPrice && (
              <div className="dropdown">
                <button onClick={() => { setPrice("all");  closeAll(); }}>All</button>
                <button onClick={() => { setPrice("free"); closeAll(); }}>Free</button>
                <button onClick={() => { setPrice("paid"); closeAll(); }}>Paid</button>
              </div>
            )}
          </div>
    </div>

       <h3 style={{ marginTop: "20px" }}>Showing: {category}</h3>
       <div className="icon-grid">
          {[...Array(40)].map((_, index) => (
            <div className="icon-card" key={index}>
               <img src="/preview1.jpg" alt="icon" className="small-icon" />
            </div>
          ))}
       </div>
      </section>
    </div>
  );
}

export default Icons;