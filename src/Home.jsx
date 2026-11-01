import { useState } from "react";
import SideMenu from "./SideMenu";
import { categories } from "./categories";
import "./Home.css";

const navItems = [
  { page: "icons", label: "Icons" },
  { page: "vectors", label: "Vectors" },
  { page: "templates", label: "Templates" },
  { page: "footage", label: "Footage" },
  { page: "create", label: "Create" },
];

const services = [
  ["01", "Brand identity", "Logos and visual systems built to be remembered."],
  ["02", "UI design", "Digital products that feel clear, useful, and distinctly yours."],
  ["03", "Motion design", "Stories brought to life through rhythm, type, and movement."],
  ["04", "Client projects", "A flexible creative partnership for ambitious briefs."],
];

// send a hero search to the library that best matches the words typed
function searchTarget(query) {
  const q = query.toLowerCase();
  if (/vector|illustration|background|pattern/.test(q)) return "vectors";
  if (/template|poster|flyer|social|presentation|card/.test(q)) return "templates";
  if (/footage|video|clip|aerial|timelapse|loop/.test(q)) return "footage";
  return "icons";
}

function Arrow() {
  return (
    <svg className="home-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

function Home({ setPage }) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (page) => (e) => {
    e?.preventDefault();
    setPage(page);
    window.scrollTo(0, 0);
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    setPage(searchTarget(q), q);
    window.scrollTo(0, 0);
  };

  return (
    <main className="home" id="top">
      {/* HEADER */}
      <header className="home-header">
        <a className="home-brand" href="#top" aria-label="Khulqi Design home">
          <img src="/logo.png" alt="" className="home-brand-mark" />
          <img src="/KD Logogram.png" alt="Khulqi Design" className="home-brand-word" />
        </a>

        <nav className="home-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item.page} href="#" onClick={go(item.page)}>{item.label}</a>
          ))}
        </nav>

        <div className="home-account">
          <a href="#" className="home-login" onClick={go("login")}>Log in</a>
          <a href="#" className="home-register" onClick={go("register")}>Register</a>
        </div>

        <button className="home-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <svg className="home-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} page="home" setPage={setPage} />

      {/* HERO */}
      <section className="home-hero">
        <div className="home-grid-room" aria-hidden="true"><div /></div>

        <div className="home-hero-content">
          <p className="home-kicker"><span /> Digital asset studio</p>
          <h1>Design<br />made <em>eazy.</em></h1>
          <p className="home-hero-copy">
            Premium icons, vectors, templates, footage, and creative solutions
            made for ambitious brands and creators.
          </p>

          <form className="home-search" onSubmit={submitSearch}>
            <label className="home-sr-only" htmlFor="home-search-input">Search digital assets</label>
            <svg className="home-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              id="home-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons, vectors, templates..."
            />
            <button type="submit">Search</button>
          </form>

          <div className="home-chips">
            {navItems.slice(0, 4).map((item) => (
              <button key={item.page} onClick={go(item.page)}>{item.label}</button>
            ))}
          </div>
        </div>

        <div className="home-counter"><strong>34K+</strong><span>Original assets</span></div>
        <a className="home-scroll-cue" href="#assets"><span>Explore assets</span><Arrow /></a>
      </section>

      {/* BROWSE ASSETS */}
      <section className="home-assets" id="assets">
        <div className="home-section-title">
          <div>
            <p className="home-label">Curated library</p>
            <h2>Browse assets</h2>
          </div>
          <p>Fresh creative resources,<br />ready for your next idea.</p>
        </div>

        <div className="home-asset-grid">
          {categories.map((cat) => (
            <article className={`home-asset-card ${cat.ready ? "" : "is-soon"}`} key={cat.key}>
              <button
                className="home-asset-preview"
                onClick={go(cat.page)}
                disabled={!cat.ready}
                aria-label={`Browse ${cat.title}`}
              >
                <img src={cat.image} alt="" loading="lazy" />
                <span className="home-asset-count">{cat.count}</span>
                {cat.key === "templates" && <span className="home-edit-hint">Edit in Create →</span>}
              </button>
              <div className="home-asset-details">
                <p>Library</p>
                <h3>{cat.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="home-services" id="services">
        <div className="home-section-title is-dark">
          <div>
            <p className="home-label">Services</p>
            <h2>Creative<br /><em>solutions.</em></h2>
          </div>
          <p>Need something built from scratch?<br />Let our studio shape the idea.</p>
        </div>

        <div className="home-service-list">
          {services.map(([number, title, copy]) => (
            <a href="#contact" className="home-service" key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
              <Arrow />
            </a>
          ))}
        </div>
      </section>

      {/* CREATOR */}
      <section className="home-creator">
        <div className="home-creator-art" aria-hidden="true">
          <span>KD</span><span>ASSET</span><span>STUDIO</span>
        </div>
        <div className="home-creator-copy">
          <p className="home-label">Made by creatives, for creatives</p>
          <h2>Build beyond<br />the ordinary.</h2>
          <p>Every asset is created with care, ready to customize, and licensed to keep your workflow moving.</p>
          <a href="#assets">Start exploring <Arrow /></a>
        </div>
      </section>

      {/* CONTACT */}
      <section className="home-contact" id="contact">
        <p className="home-label">Have a custom brief?</p>
        <h2>Let’s work<br /><em>together.</em></h2>
        <div>
          <a href="mailto:khulqidesign@mail.com">Email me <Arrow /></a>
          <a href="https://wa.me/6285236752860">WhatsApp <Arrow /></a>
        </div>
      </section>
    </main>
  );
}

export default Home;
