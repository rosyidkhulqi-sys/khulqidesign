// 404: shown for any address the site doesn't know. Same voice as the Home
// hero: one big statement, then the ways back in.
import { useState } from "react";
import "./NotFound.css";

const shortcuts = [
  ["icons", "Icons"],
  ["vectors", "Vectors"],
  ["logos", "Logos"],
  ["templates", "Templates"],
  ["footage", "Footage"],
];

function NotFound({ setPage }) {
  const [query, setQuery] = useState("");

  const go = (page, q = "") => {
    setPage(page, q);
    window.scrollTo(0, 0);
  };

  const search = (e) => {
    e.preventDefault();
    if (query.trim()) go("icons", query.trim());
  };

  return (
    <main className="nf-page">
      <p className="nf-code">404</p>
      <h1>Page not <em>found.</em></h1>
      <p className="nf-copy">
        The link may be old or mistyped. Search the library or pick up from one of these.
      </p>

      <form className="nf-search" onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons, vectors, logos..."
          aria-label="Search the library"
        />
        <button type="submit">Search</button>
      </form>

      <div className="nf-links">
        <button className="nf-home" onClick={() => go("home")}>Back to home</button>
        {shortcuts.map(([page, label]) => (
          <button key={page} onClick={() => go(page)}>{label}</button>
        ))}
      </div>
    </main>
  );
}

export default NotFound;
