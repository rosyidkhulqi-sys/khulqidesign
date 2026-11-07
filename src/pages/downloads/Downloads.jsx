import { useState } from "react";
import "./Downloads.css";

// Downloads are recorded in this browser by AssetModal; later this list
// will come from the account's download history on the server.
const STORAGE_KEY = "kd-downloads";

const kinds = [
  ["all", "All"],
  ["icon", "Icons"],
  ["vector", "Vectors"],
  ["logo", "Logos"],
  ["template", "Templates"],
  ["footage", "Footage"],
];

const kindLabel = Object.fromEntries(kinds);

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Downloads({ setPage }) {
  const [history, setHistory] = useState(loadHistory);
  const [filter, setFilter] = useState("all");

  const items = history.filter((d) => filter === "all" || d.kind === filter);

  const downloadAgain = (d) => {
    const a = document.createElement("a");
    a.href = d.file || d.image;
    a.download = `${d.id}-${d.format.replace(/\W+/g, "-")}`;
    a.click();
  };

  const clearHistory = () => {
    if (!window.confirm("Clear your download history on this device?")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    setHistory([]);
  };

  return (
    <section className="downloads-page">
      <div className="downloads-head">
        <div>
          <h1>Your downloads</h1>
          <p>{history.length} {history.length === 1 ? "file" : "files"} downloaded on this device</p>
        </div>
        {history.length > 0 && (
          <button className="downloads-clear" onClick={clearHistory}>Clear history</button>
        )}
      </div>

      {history.length > 0 && (
        <div className="downloads-tabs" role="tablist">
          {kinds.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <ul className="downloads-list">
          {items.map((d) => (
            <li key={`${d.id}-${d.date}`}>
              <img src={d.image} alt="" loading="lazy" />
              <div className="downloads-info">
                <strong>{d.title}</strong>
                <span>{kindLabel[d.kind] ?? d.kind} · {d.format} · {d.id}</span>
              </div>
              <span className={`downloads-license ${d.license === "free" ? "" : "is-premium"}`}>
                {d.license === "free" ? "Free" : `${d.license[0].toUpperCase()}${d.license.slice(1)} license`}
              </span>
              <time dateTime={d.date}>{formatDate(d.date)}</time>
              <button className="downloads-again" onClick={() => downloadAgain(d)}>Download again</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="downloads-empty">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
          </svg>
          <h2>{history.length ? "Nothing in this category" : "No downloads yet"}</h2>
          <p>Files you download from the library will show up here.</p>
          <button onClick={() => setPage("icons")}>Browse the library</button>
        </div>
      )}
    </section>
  );
}

export default Downloads;
