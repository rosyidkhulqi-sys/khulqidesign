// About us: the company behind the site, the problem it solves and who it's
// for. Only things that are true today; the numbers are real ones.
import { useEffect, useRef, useState } from "react";
import "../vectors/Vectors.css";
import "./About.css";
import Breadcrumb from "../../components/Breadcrumb";

// [final value, what it counts up from, what follows the number, label]
const facts = [
  // a year stays still: starting from itself, it has nothing to count
  [2018, 2018, "", "Creating digital assets since"],
  // placeholder until the real count comes from the database
  [34, 0, "K+", "Design assets"],
  [5, 0, "", "Asset types in one library"],
  [100, 0, "%", "Of our assets made in-house"],
];

const COUNT_MS = 1400;
const canCount = () =>
  "IntersectionObserver" in window && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// counts up once, the first time the number comes into view
function CountUp({ to, from, suffix }) {
  const [value, setValue] = useState(() => (canCount() ? from : to));
  const box = useRef(null);

  useEffect(() => {
    if (!canCount()) return;
    let frame;
    const seen = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      seen.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / COUNT_MS);
        // fast at first, settling onto the final number
        const eased = 1 - (1 - t) ** 3;
        setValue(Math.round(from + (to - from) * eased));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    seen.observe(box.current);
    return () => {
      seen.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, from]);

  return (
    <>
      {/* screen readers get the final number, not every step */}
      <span className="home-sr-only">{to}{suffix}</span>
      <span ref={box} aria-hidden="true">{value}{suffix}</span>
    </>
  );
}

const usual = [
  "Buy the asset on a stock site",
  "Open a separate editor to change it",
  "Pay another service for AI",
  "Check a different license every time",
];

const flow = [
  ["Find", "An icon, vector, logo, template or clip"],
  ["Edit", "Colors, text and layout, in your browser"],
  ["Enhance", "Remove backgrounds, upscale, animate"],
  ["Download", "With one license you can read"],
];

// a line icon per product, in the site's 24px / 1.8 stroke style
const glyphs = {
  library: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
  create: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  ai: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
  logos: <><circle cx="12" cy="9" r="5" /><path d="M8.5 13L7 21l5-3 5 3-1.5-8" /></>,
};

const offers = [
  ["library", "Assets you can change", "Recolor and resize icons, then export them as PNG, SVG, GIF, MP4 or Lottie.", "icons", "Browse the library"],
  ["create", "Templates that open in an editor", "Every template opens in Create, where you change the text, colors and layout.", "templates", "See the templates"],
  ["ai", "AI built into the work", "Remove backgrounds, upscale pictures and animate icons, free, on your own device.", "ai", "Try the AI tools"],
  ["logos", "Logos, from free to exclusive", "An exclusive logo is sold once, then taken off sale.", "logos", "Browse logos"],
];

const audiences = [
  ["Small businesses", "Logos, posts and promos, without hiring a designer for every job."],
  ["Designers and freelancers", "Editable vectors and logos for client work, with a clear license."],
  ["Content creators", "Templates, footage and animated icons for daily posts."],
  ["Web and app teams", "SVG and Lottie files, ready to drop into a product."],
];

const inHouse = [
  ["One standard", "The same quality and style across the library."],
  ["One source of rights", "No third-party uploads, so every license comes from us."],
  ["True exclusives", "An exclusive logo is sold only once."],
];

function Glyph({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyphs[name]}
    </svg>
  );
}

function About({ setPage }) {
  const go = (page) => () => {
    setPage(page);
    window.scrollTo(0, 0);
  };

  return (
    <section className="vectors-page about-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="About us" />
        <h1>
          About us <span className="library-count">Who we are</span>
        </h1>
      </div>

      <div className="ab-story">
        <h2>Design that's easy to <em>find, change and use.</em></h2>
        <p>
          Khulqidesign is a design asset platform from Indonesia, built for designers and
          businesses around the world. We bring icons, vectors, logos, templates and footage
          together with the tools to make them your own.
        </p>
        <p>
          Khulqidesign was founded by Khulqi Rosyid, a graphic designer who has been creating
          digital assets since 2018.
        </p>
      </div>

      <div className="ab-facts">
        <dl>
          {facts.map(([to, from, suffix, label]) => (
            <div key={label}>
              <dd><CountUp to={to} from={from} suffix={suffix} /></dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <p className="ab-kicker">Why we exist</p>
      <h2 className="ab-heading">One job, <em>one place.</em></h2>
      <p className="ab-lead">A simple design job often means jumping between sites. We put it all in one ecosystem.</p>
      <div className="ab-compare">
        <div className="ab-usual">
          <p className="ab-label">The usual way</p>
          <ul>
            {usual.map((text) => <li key={text}>{text}</li>)}
          </ul>
        </div>
        <div className="ab-one">
          <p className="ab-label">With Khulqidesign</p>
          <ol>
            {flow.map(([title, text]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="ab-kicker">What we have</p>
      <h2 className="ab-heading">One ecosystem, <em>not four tools.</em></h2>
      <div className="ab-grid">
        {offers.map(([glyph, title, text, page, label]) => (
          <article key={title}>
            <span className="ab-glyph"><Glyph name={glyph} /></span>
            <h3>{title}</h3>
            <p>{text}</p>
            <button onClick={go(page)}>{label} →</button>
          </article>
        ))}
      </div>

      <p className="ab-kicker">Who it's for</p>
      <h2 className="ab-heading">Made for people <em>who need design done.</em></h2>
      <div className="ab-audience">
        {audiences.map(([title, text]) => (
          <div key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="ab-inhouse">
        <div>
          <p className="ab-kicker">Our assets</p>
          <h2>Made by us. <em>Not an open marketplace.</em></h2>
          <p>Every asset is created in-house. Contributor uploads aren't open yet, which keeps the library consistent.</p>
        </div>
        <ul>
          {inHouse.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

    </section>
  );
}

export default About;
