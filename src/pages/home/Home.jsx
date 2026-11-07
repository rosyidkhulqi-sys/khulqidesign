import { useState } from "react";
import { categories } from "../../data/categories";
import "./Home.css";

const libraryLinks = [
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

// How it works: the three ways to get a design here, in the order most
// visitors need them. flow is the short path; cta opens the place to start.
const ways = [
  {
    n: "01",
    title: "Download",
    text: "Pick an icon, vector, template or clip and download it. Free assets just need a credit line; Premium unlocks every format with no attribution.",
    flow: ["Search", "Preview", "Download"],
    cta: ["Browse the library", "#assets"],
  },
  {
    n: "02",
    title: "Make it yours",
    text: "Change an icon's colors, put your own words and brand colors on a template in Create, or animate an icon with AI. Then download your version.",
    flow: ["Pick", "Edit in the browser", "Download"],
    cta: ["Open Create", "create"],
  },
  {
    n: "03",
    title: "Have it made",
    text: "Need a logo, a brand identity or motion from scratch? Send a brief and our studio designs it with you, start to finish.",
    flow: ["Brief", "Design & revise", "Final files"],
    cta: ["See services", "#services"],
  },
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
      {/* HERO */}
      <section className="home-hero">
        <div className="home-grid-room" aria-hidden="true"><div /></div>

        <div className="home-hero-content">
          <p className="home-kicker"><span /> Design asset library & studio</p>
          <h1>Design<br />made <em>eazy.</em></h1>
          {/* one plain sentence: what's here and what you can do with it */}
          <p className="home-hero-copy">
            Download icons, vectors, templates and stock footage, edit them right in your
            browser, or hire our studio for a custom design.
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
            {libraryLinks.slice(0, 4).map((item) => (
              <button key={item.page} onClick={go(item.page)}>{item.label}</button>
            ))}
          </div>

          <a className="home-studio-link" href="#services">
            Need a custom design? <strong>Work with our studio</strong> <Arrow />
          </a>
        </div>

        <div className="home-hero-bottom">
          <div className="home-counter"><strong>34K+</strong><span>Original assets</span></div>
          <a className="home-scroll-cue" href="#assets"><span>Explore assets</span><Arrow /></a>
        </div>
      </section>

      {/* HOW IT WORKS — what a first-time visitor can do here, and the path */}
      <section className="home-how" id="how">
        <div className="home-section-title is-dark">
          <div>
            <p className="home-label">How it works</p>
            <h2>Three ways to<br /><em>get it done.</em></h2>
          </div>
          <p>Use it as it is, make it yours,<br />or let our studio make it.</p>
        </div>

        <div className="home-how-grid">
          {ways.map(({ n, title, text, flow, cta: [label, target] }) => (
            <article className="home-way" key={n}>
              <span className="home-way-n">{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <ol className="home-way-flow">
                {flow.map((step) => <li key={step}>{step}</li>)}
              </ol>
              {target.startsWith("#") ? (
                <a href={target}>{label} <Arrow /></a>
              ) : (
                <button onClick={go(target)}>{label} <Arrow /></button>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* BROWSE ASSETS */}
      <section className="home-assets" id="assets">
        <div className="home-section-title">
          <div>
            <p className="home-label">Curated library</p>
            <h2>Browse assets</h2>
          </div>
          <p>Download as it is,<br />or make it yours first.</p>
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
                <h3>{cat.title}</h3>
                <p>{cat.desc}</p>
                <span>{cat.meta}</span>
              </div>
            </article>
          ))}
        </div>

        {/* the rest of the ecosystem: build it yourself, or have it made */}
        <div className="home-asset-more">
          <p>Can't find the right one?</p>
          <button onClick={go("create")}>Build it in Create <Arrow /></button>
          <button onClick={go("ai")}>Make it with AI <Arrow /></button>
          <a href="#services">Ask our studio <Arrow /></a>
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
