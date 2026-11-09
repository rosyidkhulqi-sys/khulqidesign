// About: who is behind the site and what it stands for. Only things that are
// true today; no big numbers until there are real ones to show.
import "../vectors/Vectors.css";
import "./About.css";
import Breadcrumb from "../../components/Breadcrumb";

const offers = [
  ["Library", "Icons, vectors, logos, templates and footage, with a clear license on every file.", "icons", "Browse the library"],
  ["Create", "Design posts, posters and banners in your browser, with our assets ready to drag in.", "create", "Open Create"],
  ["AI tools", "Remove backgrounds, upscale pictures and animate icons, free, on your own device.", "ai", "Try the AI tools"],
  ["Logos", "Ready-made logos, from free to exclusive. An exclusive logo is sold once, then taken off sale.", "logos", "Browse logos"],
];

const promises = [
  ["Try before you sign up", "Open the editor and the tools first. An account is only asked for when you download."],
  ["Your pictures stay yours", "The free AI tools run on your device, so your pictures are never uploaded."],
  ["Licenses in plain words", "What you can and can't do is written so anyone can read it."],
];

function About({ setPage }) {
  const go = (page) => () => {
    setPage(page);
    window.scrollTo(0, 0);
  };

  return (
    <section className="vectors-page about-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="About" />
        <h1>
          About <span className="library-count">Who makes Khulqidesign</span>
        </h1>
      </div>

      <div className="ab-story">
        <h2>Made by a designer, for people who need design done.</h2>
        <p>
          Khulqidesign began with one graphic designer drawing logos, illustrations and icons,
          and selling them as digital assets since 2018. After years of making files for other
          people's projects, the same questions kept coming up: where do I find it, can I change
          it, and am I allowed to use it?
        </p>
        <p>
          So this site puts the whole job in one place. Find an asset, make it yours in the
          browser, and download it with a license you can actually read.
        </p>
      </div>

      <h2 className="ab-heading">What you'll find here</h2>
      <div className="ab-grid">
        {offers.map(([title, text, page, label]) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
            <button onClick={go(page)}>{label} →</button>
          </article>
        ))}
      </div>

      <h2 className="ab-heading">What we promise</h2>
      <div className="ab-promises">
        {promises.map(([title, text]) => (
          <div key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="ab-contact">
        <div>
          <h2>Questions or licensing?</h2>
          <p>Write to us and you'll hear back from the designer.</p>
        </div>
        <div className="ab-contact-links">
          <a href="mailto:khulqidesign@mail.com">Email</a>
          <a href="https://wa.me/6285236752860" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      </div>
    </section>
  );
}

export default About;
