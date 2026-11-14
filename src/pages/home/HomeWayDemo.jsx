// How it works: a small looping scene above each way, showing the product
// doing it (as Apple and Magnific show theirs): a cursor picks and downloads
// an asset, recolors a design and makes the words your own, buys a logo that
// becomes yours alone. Pure CSS on real covers, so it costs no video; still
// for visitors who ask for less motion.
import "./HomeWayDemo.css";

function Cursor() {
  return (
    <svg className="hw-cursor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3l14 8-6.2 1.6L10 19z" fill="#fff" stroke="#0a0b0d" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

// 01: search, pick one, download it
function DownloadDemo({ tiles }) {
  return (
    <div className="hw-demo hw-download" aria-hidden="true">
      <div className="hw-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
        <span className="hw-typed">abstract</span>
      </div>
      <div className="hw-grid">
        {tiles.map((src, i) => (
          <span key={i} className={`hw-tile ${i === 1 ? "is-picked" : ""}`} style={{ backgroundImage: `url("${src}")` }} />
        ))}
      </div>
      <div className="hw-get">
        <span className="hw-get-label">Download</span>
        <span className="hw-get-bar" />
        <span className="hw-get-done">✓ Downloaded</span>
      </div>
      <Cursor />
    </div>
  );
}

// 02: recolor a design, then type your own words on it
function EditDemo() {
  return (
    <div className="hw-demo hw-edit" aria-hidden="true">
      <div className="hw-board">
        <span className="hw-shape hw-circle" />
        <span className="hw-shape hw-quarter" />
        <span className="hw-shape hw-bar" />
        <span className="hw-words">
          <b className="hw-word-a">SUMMER<br />SALE</b>
          <b className="hw-word-b">YOUR<br />BRAND<i className="hw-caret" /></b>
        </span>
      </div>
      <div className="hw-swatches">
        <span style={{ background: "#F5B700" }} />
        <span style={{ background: "#E63946" }} />
        <span style={{ background: "#2D6CDF" }} />
        <span style={{ background: "#0a0b0d" }} />
      </div>
      <Cursor />
    </div>
  );
}

// 03: buy an exclusive logo once; it's taken off sale and yours alone
function OwnDemo({ logo }) {
  return (
    <div className="hw-demo hw-own" aria-hidden="true">
      <div className="hw-logo">
        <span className="hw-logo-pic" style={{ backgroundImage: `url("${logo}")` }} />
        <span className="hw-tag">Exclusive</span>
        <span className="hw-stamp">Yours alone</span>
      </div>
      <div className="hw-buy">
        <span className="hw-buy-label">Buy once · $249</span>
        <span className="hw-buy-done">✓ Purchased</span>
      </div>
      <span className="hw-offsale">Taken off sale</span>
      <Cursor />
    </div>
  );
}

// way: "01" | "02" | "03"; covers: Home's store covers ({ vectors: [url], ... })
function HomeWayDemo({ way, covers = {} }) {
  if (way === "01") {
    // the second tile is the one picked: an abstract vector, as searched
    const tiles = [
      "/covers/icons.jpg",
      covers.vectors?.[0] ?? "/covers/vectors.jpg",
      covers.templates?.[0] ?? "/covers/logos.jpg",
      covers.footage?.[0] ?? "/covers/footage.jpg",
      "/covers/logos.jpg",
      "/covers/footage.jpg",
    ];
    return <DownloadDemo tiles={tiles} />;
  }
  if (way === "02") return <EditDemo />;
  return <OwnDemo logo={covers.logos?.[0] ?? "/covers/logos.jpg"} />;
}

export default HomeWayDemo;
