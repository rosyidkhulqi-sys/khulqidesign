import { useEffect, useState } from "react";
import { categories } from "../../data/categories";
import { PLANS } from "../../data/plans";
import "./Home.css";

const libraryLinks = [
  { page: "icons", label: "Icons" },
  { page: "vectors", label: "Vectors" },
  { page: "logos", label: "Logos" },
  { page: "templates", label: "Templates" },
  { page: "footage", label: "Footage" },
  { page: "create", label: "Create" },
];

// The studio opens later (about a year from Nov 2026); until then Services
// only says what's coming, and every call to action points to a product.
const services = [
  ["01", "Brand identity", "Custom logos and brand systems, designed from scratch."],
  ["02", "UI design", "Digital products that feel clear, useful, and distinctly yours."],
  ["03", "Motion design", "Stories brought to life through rhythm, type, and movement."],
  ["04", "Client projects", "A flexible creative partnership for ambitious briefs."],
];

// How it works: the three ways to get a design here, in the order most
// visitors need them. flow is the short path; cta opens the place to start.
// All three are products; the studio isn't open yet.
const ways = [
  {
    n: "01",
    title: "Download",
    text: `Pick an icon, vector, template or clip and download it. A free account takes ${PLANS.freePerDay} a day; Premium unlocks every format with no credit line.`,
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
    title: "Own it outright",
    text: "Buy an exclusive logo once and it's yours alone: taken off sale, with the full files and rights. Free and Premium logos are there too.",
    flow: ["Pick a logo", "Buy once", "Yours alone"],
    cta: ["Browse logos", "logos"],
  },
];

// free with an account, running in the visitor's browser
const aiTools = [
  ["Remove background", "Cut the subject out of a photo, product shot or illustration, ready as a transparent PNG."],
  ["Upscale 2× and 4×", "Make a small picture bigger and sharper for print, slides or a website."],
  ["Animate an icon", "Turn any icon in the library into a short animation."],
];

// a short version of the Pricing page; the details live there
const plans = [
  {
    name: "Free",
    price: "$0",
    per: "forever",
    points: [`${PLANS.freePerDay} downloads a day`, "Edit in Create and the icon editor", "Free AI tools", "Credit line required"],
  },
  {
    name: "Premium",
    price: `$${PLANS.yearly}`,
    per: `a month, billed yearly ($${PLANS.monthly} monthly)`,
    points: ["Every Premium asset", "Unlimited downloads (fair use)", "SVG, EPS and copy to Figma", "No credit line"],
    featured: true,
  },
  {
    name: "Founding member",
    price: `$${PLANS.founding}`,
    per: `a year, for the first ${PLANS.foundingSeats} members`,
    points: ["Everything in Premium", "Price locked while you stay", "Helps shape the library"],
  },
];

// send a hero search to the library that best matches the words typed
function searchTarget(query) {
  const q = query.toLowerCase();
  if (/logo|brand|monogram|mascot/.test(q)) return "logos";
  if (/vector|illustration|background|pattern/.test(q)) return "vectors";
  if (/template|poster|flyer|social|presentation|card/.test(q)) return "templates";
  if (/footage|video|clip|aerial|timelapse|loop/.test(q)) return "footage";
  return "icons";
}

// the hero's changing word, one library after another
const heroWords = ["icons", "vectors", "logos", "templates", "footage"];

function RotatingWord({ words, every = 2200 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    // people who asked for less motion get the word list without the changing
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setI((n) => (n + 1) % words.length), every);
    return () => clearInterval(timer);
  }, [words, every]);
  return (
    <>
      {/* screen readers hear the whole list once, not a word every two seconds */}
      <span className="home-sr-only">{words.join(", ")}</span>
      <span className="home-rotate" key={i} aria-hidden="true">{words[i]}</span>
    </>
  );
}

function Arrow() {
  return (
    <svg className="home-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

// user: the signed-in account, or null; visitors also see invitations to join
function Home({ setPage, user = null }) {
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
          <p className="home-kicker"><span /> Design asset library</p>
          <h1>Design<br />made <em>eazy.</em></h1>
          {/* one plain sentence: what's here and what you can do with it */}
          <p className="home-hero-copy">
            Download ready-made <RotatingWord words={heroWords} />, or edit them right in
            your browser first.
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
              placeholder="Search icons, vectors, logos, templates..."
            />
            <button type="submit">Search</button>
          </form>

          <div className="home-chips">
            {libraryLinks.filter((item) => item.page !== "create").map((item) => (
              <button key={item.page} onClick={go(item.page)}>{item.label}</button>
            ))}
          </div>

          {!user && (
            <div className="home-join">
              <button onClick={go("register")}>Create free account</button>
              <span>{PLANS.freePerDay} free downloads a day. No card needed.</span>
            </div>
          )}

          {/* the newest product, where the studio link used to be */}
          <button className="home-studio-link" onClick={go("logos")}>
            New: ready-made logos, free to exclusive <strong>Browse logos</strong> <Arrow />
          </button>
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
          <p>Use it as it is, make it yours,<br />or own it outright.</p>
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

        {/* the rest of the ecosystem: build it yourself */}
        <div className="home-asset-more">
          <p>Can't find the right one?</p>
          <button onClick={go("create")}>Build it in Create <Arrow /></button>
          <button onClick={go("ai")}>Make it with AI <Arrow /></button>
        </div>
      </section>

      {/* FREE AI TOOLS — a reason to sign up today */}
      <section className="home-ai">
        <div className="home-section-title">
          <div>
            <p className="home-label">Free AI tools</p>
            <h2>AI that runs<br /><em>in your browser.</em></h2>
          </div>
          <p>Free with an account.<br />Your pictures never leave your device.</p>
        </div>
        <div className="home-ai-grid">
          {aiTools.map(([title, text]) => (
            <button className="home-ai-card" key={title} onClick={go("ai")}>
              <h3>{title}</h3>
              <p>{text}</p>
              <span>Try it <Arrow /></span>
            </button>
          ))}
        </div>
      </section>

      {/* PLANS — Free and Premium at a glance */}
      <section className="home-plans">
        <div className="home-section-title is-dark">
          <div>
            <p className="home-label">Plans</p>
            <h2>Start free,<br /><em>grow with Premium.</em></h2>
          </div>
          <p>Prices in USD.<br />Cancel anytime.</p>
        </div>
        <div className="home-plan-grid">
          {plans.map((p) => (
            <article className={`home-plan ${p.featured ? "is-featured" : ""}`} key={p.name}>
              <h3>{p.name}</h3>
              <p className="home-plan-price"><strong>{p.price}</strong><span>{p.per}</span></p>
              <ul>
                {p.points.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </article>
          ))}
        </div>
        <div className="home-plan-actions">
          {!user && <button className="home-plan-main" onClick={go("register")}>Create free account</button>}
          <button onClick={go("pricing")}>Compare plans <Arrow /></button>
        </div>
      </section>

      {/* SERVICES */}
      <section className="home-services" id="services">
        <div className="home-section-title is-dark">
          <div>
            <p className="home-label">Services · Coming soon</p>
            <h2>Creative<br /><em>solutions.</em></h2>
          </div>
          <p>Custom design work<br />opens later.</p>
        </div>

        {/* not links yet: the studio isn't taking projects */}
        <div className="home-service-list is-soon">
          {services.map(([number, title, copy]) => (
            <div className="home-service" key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
              <em className="home-soon">Coming soon</em>
            </div>
          ))}
        </div>
      </section>

      {/* CREATOR */}
      <section className="home-creator">
        <div className="home-creator-art" aria-hidden="true">
          <span>KD</span><span>DESIGN</span><span>ASSETS</span>
        </div>
        <div className="home-creator-copy">
          <p className="home-label">Made by creatives, for creatives</p>
          <h2>Build beyond<br />the ordinary.</h2>
          <p>Every asset is created with care, ready to customize, and licensed to keep your workflow moving.</p>
          <a href="#assets">Start exploring <Arrow /></a>
        </div>
      </section>

      {/* LAST CALL — one clear next step before the footer */}
      {!user && (
        <section className="home-cta">
          <h2>Ready when <em>you are.</em></h2>
          <p>Join free and download your first assets today.</p>
          <button onClick={go("register")}>Create free account <Arrow /></button>
        </section>
      )}

      {/* CONTACT */}
      <section className="home-contact" id="contact">
        <p className="home-label">Questions or licensing?</p>
        <h2>Get in<br /><em>touch.</em></h2>
        <div>
          <a href="mailto:khulqidesign@mail.com">Email me <Arrow /></a>
          <a href="https://wa.me/6285236752860">WhatsApp <Arrow /></a>
        </div>
      </section>
    </main>
  );
}

export default Home;
