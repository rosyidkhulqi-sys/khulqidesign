// Terms of Service and Privacy Policy share this page: a contents list on
// the left, the sections on the right. The text lives in data/legal.js.
import "../vectors/Vectors.css";
import "./Legal.css";
import Breadcrumb from "../../components/Breadcrumb";
import { UPDATED, privacy, terms } from "../../data/legal";

const docs = {
  terms: { title: "Terms of Service", lead: "The rules for using Khulqidesign, in plain words.", sections: terms },
  privacy: { title: "Privacy Policy", lead: "What we collect, why, and what you can ask us to do with it.", sections: privacy },
};

function Legal({ doc, setPage }) {
  const { title, lead, sections } = docs[doc];
  const other = doc === "terms" ? ["privacy", "Privacy Policy"] : ["terms", "Terms of Service"];

  const jump = (id) => (e) => {
    e.preventDefault();
    document.getElementById(`lg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="vectors-page legal-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current={title} />
        <h1>
          {title} <span className="library-count">Updated {UPDATED}</span>
        </h1>
      </div>
      <p className="lg-lead">{lead}</p>

      <div className="lg-body">
        <nav className="lg-toc" aria-label="Contents">
          <p>Contents</p>
          {sections.map(([id, heading]) => (
            <a key={id} href={`#lg-${id}`} onClick={jump(id)}>{heading}</a>
          ))}
          <button onClick={() => { setPage(other[0]); window.scrollTo(0, 0); }}>
            {other[1]} →
          </button>
        </nav>

        <article className="lg-text">
          {sections.map(([id, heading, paragraphs], i) => (
            <section key={id} id={`lg-${id}`}>
              <h2><span>{String(i + 1).padStart(2, "0")}</span>{heading}</h2>
              {paragraphs.map((p) => <p key={p}>{p}</p>)}
            </section>
          ))}
        </article>
      </div>
    </section>
  );
}

export default Legal;
