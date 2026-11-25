// Search across every library, as Adobe Stock's "All" and Envato's "All
// categories": the results come grouped by library, a few of each, and each
// group leads into its own library (its own filters, editor and licenses)
// with the same words. Libraries with nothing found stay out.
import { useEffect, useState } from "react";
import "./Search.css";
import Breadcrumb from "../../components/Breadcrumb";
import { libraries } from "../../data/libraries";
import { searchCatalog } from "../../lib/catalog";
import { publicUrl } from "../../lib/r2";

const PER_GROUP = 6;

function Search({ setPage, initialSearch = "" }) {
  const [text, setText] = useState(initialSearch);
  const [query, setQuery] = useState(initialSearch.trim());
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all(libraries.map((lib) =>
      searchCatalog(lib.type, { text: query, sort: "popular", perPage: PER_GROUP })
        .then(({ rows, total }) => ({ lib, rows, total }))
        .catch(() => ({ lib, rows: [], total: 0 }))))
      .then((all) => alive && setGroups(all.filter((g) => g.total > 0).sort((a, b) => b.total - a.total)));
    return () => {
      alive = false;
    };
  }, [query]);

  const open = (page) => {
    setPage(page, query);
    window.scrollTo(0, 0);
  };

  const submit = (e) => {
    e.preventDefault();
    if (text.trim() === query) return;
    setGroups(null);
    setQuery(text.trim());
    window.history.replaceState(null, "", text.trim() ? `/search?q=${encodeURIComponent(text.trim())}` : "/search");
  };

  const total = groups?.reduce((n, g) => n + g.total, 0) ?? 0;

  return (
    <section className="vectors-page search-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="Search" />
        <h1>
          {query ? <>Results for “{query}”</> : "All assets"}
          {groups && <span className="library-count">{total} in {groups.length} {groups.length === 1 ? "library" : "libraries"}</span>}
        </h1>
      </div>

      <form className="icon-search" onSubmit={submit}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)}
               placeholder="Search icons, photos, fonts, templates..." aria-label="Search every library" />
        <button className="search-submit" aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </button>
      </form>

      {!groups ? (
        <p className="search-note">Searching every library…</p>
      ) : groups.length === 0 ? (
        <div className="no-results">
          <h3>Nothing found for “{query}”</h3>
          <p>Try other words, or browse a library:</p>
          <div className="search-libraries">
            {libraries.map((l) => <button key={l.page} onClick={() => open(l.page)}>{l.title}</button>)}
          </div>
        </div>
      ) : (
        groups.map(({ lib, rows, total: n }) => (
          <div className="search-group" key={lib.page}>
            <div className="search-group-head">
              <h2>{lib.title} <span>{n} {lib.unit[n === 1 ? 0 : 1]}</span></h2>
              <button onClick={() => open(lib.page)}>See all in {lib.title} →</button>
            </div>
            <div className={`search-row is-${lib.type}`}>
              {rows.map((row) => (
                <button key={row.code} onClick={() => open(lib.page)} aria-label={row.title} title={row.title}>
                  <img src={publicUrl(row.thumb_key)} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export default Search;
