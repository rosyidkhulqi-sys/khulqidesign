import { useEffect, useRef, useState } from "react";
import AssetModal from "../../components/AssetModal";
import "../vectors/Vectors.css";
import "./Footage.css";
import Breadcrumb from "../../components/Breadcrumb";
import AiSearchButton from "../../components/AiSearchButton";
import { ToolGlyph } from "../../components/IconControls";
import { clips as trialClips } from "../../data/footageData";
import { fetchPublished, toClip } from "../../lib/catalog";

const durationRange = {
  short: (d) => d < 10,
  medium: (d) => d >= 10 && d <= 30,
  long: (d) => d > 30,
};

const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const aspect = {
  horizontal: ["16 / 9", "16:9"],
  vertical: ["9 / 16", "9:16"],
  square: ["1 / 1", "1:1"],
};

const px = ([w, h]) => `${w}×${h}`;
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// one option per real file; HD and web renditions will come from the backend
function clipOptions(clip) {
  // uploaded clips: one option per original, downloads open with signed links
  if (clip.originals) {
    return clip.originals.map((o) => ({
      label: o.format === "MOV" ? "Master MOV" : clip.resolution === "4K" ? "4K UHD" : "Full HD",
      detail: `${px([o.width ?? clip.size[0], o.height ?? clip.size[1]])} · ${o.format === "MOV" ? "QuickTime" : "MP4 H.264"}`,
      size: `${(o.bytes / 1_000_000).toFixed(o.bytes > 100_000_000 ? 0 : 1)} MB`,
      file: null,
      pending: true,
      ext: o.format.toLowerCase(),
    }));
  }
  return [
    {
      label: clip.resolution === "4K" ? "4K UHD" : "Full HD",
      detail: `${px(clip.size)} · MP4 H.264`,
      size: clip.sizeLabel,
      file: clip.file,
      ext: "mp4",
    },
  ];
}

function clipSpecs(clip) {
  return [
    ["Clip ID", clip.code],
    ["Duration", formatTime(clip.duration)],
    ["Resolution", `${px(clip.size)} (${clip.resolution === "4K" ? "4K UHD" : "Full HD"})`],
    ["Frame rate", `${clip.fps} fps`],
    ["Aspect ratio", aspect[clip.orientation][1]],
    ["Seamless loop", clip.loop ? "Yes" : "No"],
    ["Audio", "No audio"],
    ["Release", "Not required"],
    ["Category", capitalize(clip.category)],
  ];
}

function FootageCard({ clip, onOpen }) {
  const ref = useRef(null);
  const bar = useRef(null);
  const frame = useRef(0);
  // the clip is loading or buffering while the pointer is on the card
  const [loading, setLoading] = useState(false);

  // stop the progress loop if the card leaves the page mid-play
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // the progress bar follows the video every frame; timeupdate fires only
  // about four times a second, which looks jumpy on a short clip
  const track = () => {
    const v = ref.current;
    if (v && bar.current && v.duration) {
      bar.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
    }
    frame.current = requestAnimationFrame(track);
  };

  const play = () => {
    const v = ref.current;
    if (!v) return;
    // HAVE_FUTURE_DATA: enough is loaded to start without waiting
    if (v.readyState < 3) setLoading(true);
    v.play().catch(() => setLoading(false));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(track);
  };

  const stop = () => {
    cancelAnimationFrame(frame.current);
    setLoading(false);
    if (bar.current) bar.current.style.transform = "scaleX(0)";
    const v = ref.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <div className="footage-card" onMouseEnter={play} onMouseLeave={stop} onClick={onOpen}>
      <div
        className="footage-thumb"
        style={{ aspectRatio: aspect[clip.orientation][0] }}
      >
        <img src={clip.image} alt={clip.title} loading="lazy" />
        <video
          ref={ref}
          src={clip.file}
          muted
          loop
          playsInline
          preload="none"
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
        />
        {loading && <span className="footage-spinner" role="status" aria-label="Loading preview" />}
        <span className="footage-progress" aria-hidden="true">
          <span ref={bar} />
        </span>
        <span className={`vector-badge ${clip.license}`}>
          {clip.license === "free" ? "Free" : "Premium"}
        </span>
        <span className="footage-res">{clip.resolution}</span>
        <span className="footage-duration">
          <ToolGlyph name="play" size={9} filled />
          {formatTime(clip.duration)}
        </span>
      </div>
      <p className="vector-name">{clip.title}</p>
    </div>
  );
}

function Footage({ setPage, initialSearch = "", user = null }) {
  const [search, setSearch] = useState(initialSearch);
  const [resolution, setResolution] = useState("all");
  const [fps, setFps] = useState("all");
  const [duration, setDuration] = useState("all");
  const [orientation, setOrientation] = useState("all");
  const [license, setLicense] = useState("all");
  const [sort, setSort] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  // clips uploaded through /admin, newest first, ahead of the trial clips
  const [uploaded, setUploaded] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchPublished("footage")
      .then((rows) => alive && setUploaded(rows.map(toClip)))
      .catch(() => {
        /* the trial clips still show if the catalogue can't be reached */
      });
    return () => {
      alive = false;
    };
  }, []);
  const allClips = [...uploaded, ...trialClips];

  const perPage = 24;

  const reset = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const q = search.toLowerCase();
  const filtered = allClips
    // the short title, the clip's own title and description, a whole keyword
    // phrase, or the start of any word in a keyword
    .filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.searchText.includes(q) ||
      c.keywords.some((k) => k.startsWith(q) || k.split(" ").some((word) => word.startsWith(q)))
    )
    .filter((c) => resolution === "all" || c.resolution === resolution)
    .filter((c) => fps === "all" || c.fps === Number(fps))
    .filter((c) => duration === "all" || durationRange[duration](c.duration))
    .filter((c) => orientation === "all" || c.orientation === orientation)
    .filter((c) => license === "all" || c.license === license)
    .sort((a, b) =>
      sort === "popular" ? b.downloads - a.downloads : b.id - a.id
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const items = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const clearFilters = () => {
    setResolution("all");
    setFps("all");
    setDuration("all");
    setOrientation("all");
    setLicense("all");
    setSort("popular");
    setSearch("");
    setCurrentPage(1);
  };

  const hasFilter =
    resolution !== "all" || fps !== "all" || duration !== "all" ||
    orientation !== "all" || license !== "all" || search;

  const searchTag = (tag) => {
    setSelected(null);
    setSearch(tag);
    setCurrentPage(1);
  };

  return (
    <section className="vectors-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="Footage" />
        {/* the count sits by the title, so results start higher */}
        <h1>
          Footage <span className="library-count">{filtered.length} clips</span>
        </h1>
      </div>

      {/* SEARCH */}
      <div className="icon-search">
        <select className="search-type" value="footage" onChange={() => {}}>
          <option value="footage">Footage</option>
        </select>
        <input
          type="text"
          placeholder="Search footage, aerial, timelapse, slow motion, loops..."
          value={search}
          onChange={reset(setSearch)}
        />
        {search && (
          <button className="clear-search" onClick={() => setSearch("")}>
            ×
          </button>
        )}
        <AiSearchButton example="slow abstract loop in blue for a background" />
        <button className="search-submit" aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </button>
      </div>

      {/* FILTER ROW */}
      <div className="vector-filters">
        <select value={resolution} onChange={reset(setResolution)}>
          <option value="all">Resolution</option>
          <option value="4K">4K UHD</option>
          <option value="HD">Full HD</option>
        </select>

        <select value={fps} onChange={reset(setFps)}>
          <option value="all">Frame rate</option>
          <option value="24">24 fps</option>
          <option value="30">30 fps</option>
          <option value="60">60 fps</option>
        </select>

        <select value={duration} onChange={reset(setDuration)}>
          <option value="all">Duration</option>
          <option value="short">Under 10s</option>
          <option value="medium">10s – 30s</option>
          <option value="long">Over 30s</option>
        </select>

        <select value={orientation} onChange={reset(setOrientation)}>
          <option value="all">Orientation</option>
          <option value="horizontal">Horizontal 16:9</option>
          <option value="vertical">Vertical 9:16</option>
          <option value="square">Square 1:1</option>
        </select>

        <select value={license} onChange={reset(setLicense)}>
          <option value="all">License</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>

        {hasFilter && (
          <button className="clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        )}

        <div className="vector-sort">
          <select value={sort} onChange={reset(setSort)}>
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* GRID */}
      <div className="footage-grid">
        {items.length > 0 ? (
          items.map((c) => (
            <FootageCard key={c.id} clip={c} onOpen={() => setSelected(c)} />
          ))
        ) : (
          <div className="no-results">
            <h3>No footage found</h3>
            <p>Try another search or filter.</p>
            {hasFilter && (
              <button className="clear-filters" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* PAGINATION */}
      <div className="pagination">
        <button
          className="page-arrow"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          ‹
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
          .map((p) => (
            <button
              key={p}
              className={`page-number ${currentPage === p ? "active" : ""}`}
              onClick={() => setCurrentPage(p)}
            >
              {p}
            </button>
          ))}
        <button
          className="page-arrow"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          ›
        </button>
      </div>

      {selected && (
        <AssetModal
          key={selected.id}
          asset={selected}
          kind="footage"
          options={clipOptions(selected)}
          specs={clipSpecs(selected)}
          related={allClips
            .filter((c) => c.category === selected.category && c.id !== selected.id)
            .slice(0, 6)}
          user={user}
          onAuth={(target) => {
            setSelected(null);
            setPage(target);
            window.scrollTo(0, 0);
          }}
          onSelect={setSelected}
          onTag={searchTag}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

export default Footage;
