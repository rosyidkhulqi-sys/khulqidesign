import { useRef, useState } from "react";
import PageHeader from "./PageHeader";
import AssetModal from "./AssetModal";
import "./Vectors.css";
import "./Video.css";

const previews = ["/preview4.jpg", "/preview2.jpg", "/preview3.jpg", "/preview1.jpg"];
const clipFile = "/video%20background.mp4";

const subjects = [
  ["aerial view of tropical beach", "travel", ["aerial", "beach", "ocean", "drone", "summer"]],
  ["timelapse of city traffic at night", "city", ["timelapse", "city", "traffic", "night", "urban"]],
  ["abstract neon light loop", "abstract", ["abstract", "neon", "loop", "light", "background"]],
  ["slow motion coffee pour", "food", ["coffee", "slow motion", "drink", "cafe", "morning"]],
  ["sunrise over misty mountains", "nature", ["sunrise", "mountain", "fog", "landscape", "nature"]],
  ["retro VHS glitch overlay", "abstract", ["retro", "vhs", "glitch", "overlay", "vintage"]],
  ["business team meeting in office", "business", ["business", "team", "office", "meeting", "people"]],
  ["floating particles background", "abstract", ["particles", "background", "loop", "bokeh", "motion"]],
  ["rain drops on window glass", "nature", ["rain", "window", "water", "weather", "mood"]],
  ["drone shot of rice terraces", "travel", ["drone", "rice field", "bali", "green", "aerial"]],
  ["fireworks celebration at night", "holiday", ["fireworks", "celebration", "new year", "night", "festival"]],
  ["ocean waves crashing slow motion", "nature", ["ocean", "waves", "slow motion", "sea", "water"]],
];

const allClips = Array.from({ length: 96 }, (_, i) => {
  const [title, category, tags] = subjects[i % subjects.length];
  const resolution = i % 3 === 2 ? "HD" : "4K";
  return {
    id: i + 1,
    code: `KD-FT-${String(300000 + i * 7).padStart(6, "0")}`,
    title,
    category,
    image: previews[i % previews.length],
    file: clipFile,
    resolution,
    fps: [24, 30, 60][i % 3],
    duration: 5 + ((i * 13) % 40),
    orientation: ["horizontal", "horizontal", "square", "horizontal", "vertical"][i % 5],
    license: i % 3 === 0 ? "premium" : "free",
    loop: category === "abstract",
    downloads: (i * 53) % 900,
    keywords: [...tags, category, "footage", "stock video", resolution === "4K" ? "4k" : "hd"],
  };
});

const durationRange = {
  short: (d) => d < 10,
  medium: (d) => d >= 10 && d <= 30,
  long: (d) => d > 30,
};

const formatTime = (s) => `0:${String(s).padStart(2, "0")}`;

const aspect = {
  horizontal: ["16 / 9", "16:9"],
  vertical: ["9 / 16", "9:16"],
  square: ["1 / 1", "1:1"],
};

// w×h given in landscape; flipped or squared to match the clip orientation
const sizeFor = (orientation, w, h) =>
  orientation === "vertical" ? `${h}×${w}` : orientation === "square" ? `${h}×${h}` : `${w}×${h}`;

function clipOptions(clip) {
  const mb = (rate) => `${Math.round(clip.duration * rate)} MB`;
  const dim = (w, h) => sizeFor(clip.orientation, w, h);
  const list = [
    { label: "Full HD", detail: `${dim(1920, 1080)} · MP4 H.264`, size: mb(2.5) },
    { label: "HD 720p", detail: `${dim(1280, 720)} · MP4 H.264`, size: mb(1.2) },
    { label: "Web SD", detail: `${dim(640, 360)} · MP4 H.264`, size: mb(0.4) },
  ];
  if (clip.resolution === "4K") {
    list.unshift({ label: "4K UHD", detail: `${dim(3840, 2160)} · MOV ProRes 422`, size: mb(18) });
  }
  return list;
}

function clipSpecs(clip) {
  return [
    ["Clip ID", clip.code],
    ["Duration", formatTime(clip.duration)],
    ["Max resolution", clip.resolution === "4K"
      ? `${sizeFor(clip.orientation, 3840, 2160)} (4K UHD)`
      : `${sizeFor(clip.orientation, 1920, 1080)} (Full HD)`],
    ["Frame rate", `${clip.fps} fps`],
    ["Aspect ratio", aspect[clip.orientation][1]],
    ["Seamless loop", clip.loop ? "Yes" : "No"],
    ["Audio", "No audio"],
    ["Release", "Model & property release not required"],
    ["Category", clip.category],
  ];
}

function VideoCard({ clip, onOpen }) {
  const ref = useRef(null);

  const play = () => ref.current?.play().catch(() => {});
  const stop = () => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <div className="video-card" onMouseEnter={play} onMouseLeave={stop} onClick={onOpen}>
      <div
        className="video-thumb"
        style={{ aspectRatio: aspect[clip.orientation][0] }}
      >
        <img src={clip.image} alt={clip.title} loading="lazy" />
        <video ref={ref} src={clip.file} muted loop playsInline preload="none" />
        <span className={`vector-badge ${clip.license}`}>
          {clip.license === "free" ? "Free" : "Premium"}
        </span>
        <span className="video-res">{clip.resolution}</span>
        <span className="video-duration">▶ {formatTime(clip.duration)}</span>
      </div>
      <p className="vector-name">{clip.title}</p>
    </div>
  );
}

function Video({ setPage }) {
  const [search, setSearch] = useState("");
  const [resolution, setResolution] = useState("all");
  const [fps, setFps] = useState("all");
  const [duration, setDuration] = useState("all");
  const [orientation, setOrientation] = useState("all");
  const [license, setLicense] = useState("all");
  const [sort, setSort] = useState("popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const perPage = 24;

  const reset = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const q = search.toLowerCase();
  const filtered = allClips
    .filter((c) => c.title.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q)))
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
      <PageHeader page="video" setPage={setPage} />

      {/* SEARCH */}
      <div className="icon-search">
        <select className="search-type" value="video" onChange={() => {}}>
          <option value="video">Footage</option>
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

      <p className="vector-count">{filtered.length} clips</p>

      {/* GRID */}
      <div className="video-grid">
        {items.length > 0 ? (
          items.map((c) => (
            <VideoCard key={c.id} clip={c} onOpen={() => setSelected(c)} />
          ))
        ) : (
          <div className="no-results">
            <h3>No footage found</h3>
            <p>Try another search or filter.</p>
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
          kind="video"
          options={clipOptions(selected)}
          specs={clipSpecs(selected)}
          related={allClips
            .filter((c) => c.category === selected.category && c.id !== selected.id)
            .slice(0, 6)}
          onSelect={setSelected}
          onTag={searchTag}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

export default Video;
