// How it works, shown rather than told (as Magnific and Apple do): the three
// ways on the left, one at a time, each with a progress line that moves on to
// the next; on the right a stage of the real thing: assets from the store
// that drift with the pointer; the Create editor recorded at work (a color
// changed, the headline retyped); and a logo's page recorded as its mockups
// are tried. Each recording zooms where the pointer is. Click a way to stay.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { publicUrl } from "../../lib/r2";
import "./HomeShowcase.css";

// how long each way stays; Make it yours plays its whole edit first
// (Download types three searches and holds the footage one while its clip plays)
const STEP_MS = [11000, 9500, 8000];

// what the Download stage's search bar types, which results then show, and
// how long the finished words stay (in 70 ms ticks; the clip needs longer)
const SEARCHES = [
  ["Abstract background", "vector", 18],
  ["Icons", "icon", 18],
  ["Abstract footage", "footage", 44],
];

const TYPED = SEARCHES.map(([words]) => words);
const HOLDS = SEARCHES.map(([, , hold]) => hold);

function WayIcon({ i }) {
  const paths = [
    <path key="0" d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" />,
    <path key="1" d="M4 20l4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM13.5 7.5l3 3" />,
    <path key="2" d="M4 18h16M5 15l-1.5-8 5 3.5L12 5l3.5 5.5 5-3.5-1.5 8z" />,
  ];
  return (
    <svg className="hs-way-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[i]}</svg>
  );
}

// a search bar that types one phrase after another; onPhrase(i) tells which
// holds: how long each finished phrase stays, in ticks
function Typing({ phrases, holds = [], run, onPhrase }) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!run) return;
    // typing starts again from the first phrase, and the cards follow
    onPhrase?.(0);
    let phrase = 0;
    let at = 0;
    let back = false;
    const timer = setInterval(() => {
      const word = phrases[phrase];
      if (!back) {
        at += 1;
        if (at > word.length + (holds[phrase] ?? 18)) back = true; // hold the full phrase a moment
      } else {
        at -= 2;
        if (at <= 0) {
          back = false;
          phrase = (phrase + 1) % phrases.length;
          at = 0;
          onPhrase?.(phrase);
        }
      }
      setText(phrases[phrase].slice(0, Math.max(0, Math.min(at, phrases[phrase].length))));
    }, 70);
    return () => clearInterval(timer);
  }, [phrases, holds, run, onPhrase]);
  return (
    <div className="hs-search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
      <span>{run ? text : phrases[0]}</span>
      <i className="hs-caret" />
    </div>
  );
}

// a few real assets for the Download stage: vectors, icons and a clip
async function fetchStage() {
  const query = (type, field, count, style, word) => {
    let q = supabase
      .from("assets")
      .select(field)
      .eq("type", type)
      .eq("status", "published")
      .not(field, "is", null)
      .match(style ? { style } : {});
    if (word) q = q.contains("keywords", [word]);
    return q
      .order("downloads", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(count)
      .then(({ data }) => (data ?? []).map((row) => publicUrl(row[field])));
  };
  // what the typed search says ("Abstract background"), topped up with the
  // most downloaded when there are too few
  const pick = async (type, field, count, style = null, word = null) => {
    const matched = word ? await query(type, field, count, style, word) : [];
    if (matched.length >= count) return matched;
    const more = await query(type, field, count, style, null);
    return [...new Set([...matched, ...more])].slice(0, count);
  };
  // the chosen assets, in their order; one that is hidden or deleted is
  // skipped, and only then does the automatic pick fill in
  const pinned = async (codes, fallback) => {
    const { data } = await supabase.from("assets").select("code, thumb_key").in("code", codes).eq("status", "published");
    const urls = codes.map((c) => data?.find((row) => row.code === c)).filter(Boolean).map((row) => publicUrl(row.thumb_key));
    if (urls.length >= codes.length) return urls;
    return [...new Set([...urls, ...(await fallback())])].slice(0, codes.length);
  };
  const [vectors, glyphs, outlines, hands, footage] = await Promise.all([
    pinned(STAGE.vectors, () => pick("vector", "thumb_key", 4, null, "abstract")),
    pinned(STAGE.glyphs, () => pick("icon", "thumb_key", 6, "glyph")),
    pinned(STAGE.outlines, () => pick("icon", "thumb_key", 6, "outline")),
    pinned(STAGE.hands, () => pick("icon", "thumb_key", 6, "hand-drawn")),
    pinned(STAGE.footage, () => pick("footage", "thumb_key", 5, null, "abstract")),
  ]);
  return { vectors, glyphs, outlines, hands, footage };
}

// What the Download stage shows, chosen by hand so a new upload never
// changes it. Change a code here to show another asset.
const STAGE = {
  vectors: ["KD-VC-8425149", "KD-VC-2229871", "KD-VC-8414086", "KD-VC-5595743"],
  footage: ["KD-FT-8422335", "KD-FT-3786319", "KD-FT-4346269", "KD-FT-2904492", "KD-FT-6046389"],
  glyphs: ["KD-IC-1433578", "KD-IC-8993973", "KD-IC-1093670", "KD-IC-8168929", "KD-IC-3710181", "KD-IC-7207070"],
  outlines: ["KD-IC-1870430", "KD-IC-9369617", "KD-IC-2608837", "KD-IC-6229929", "KD-IC-1608286", "KD-IC-1028112"],
  hands: ["KD-IC-5920720", "KD-IC-3071369", "KD-IC-8554706", "KD-IC-4308568", "KD-IC-4940032", "KD-IC-3067745"],
};

// ways: [{ n, title, text, flow, cta: [label, target] }]; covers: Home's
// store covers; go(target) opens a page; reduced: the visitor asked for less motion
function HomeShowcase({ ways, covers = {}, go }) {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false); // clicked: stays on that way
  const [stage, setStage] = useState({ vectors: [], glyphs: [], outlines: [], hands: [], footage: [] });
  const [inView, setInView] = useState(false);
  // the Download stage's search, as an index into SEARCHES
  const [phrase, setPhrase] = useState(0);
  const stageRef = useRef(null);
  const clipRef = useRef(null);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    let alive = true;
    fetchStage().then((s) => alive && setStage(s)).catch(() => {});
    return () => { alive = false; };
  }, []);

  // only runs (and only plays the clip) while it's on screen
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the stage leans toward the pointer; the editor zooms where it points
  const onMove = (e) => {
    if (reduced) return;
    const el = stageRef.current;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", (x - 0.5).toFixed(3));
    el.style.setProperty("--my", (y - 0.5).toFixed(3));
    el.style.setProperty("--zx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--zy", `${(y * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    const el = stageRef.current;
    el.style.setProperty("--mx", 0);
    el.style.setProperty("--my", 0);
  };

  // the clip plays while the Download scene is on screen, from the start each
  // time its search comes up; muted is set on the element itself, as
  // browsers only autoplay a video that is really muted
  const playClip = inView && !reduced && active === 0;
  const footageUp = SEARCHES[phrase][1] === "footage";
  useEffect(() => {
    const video = clipRef.current;
    if (!video) return;
    video.muted = true;
    if (!playClip) {
      video.pause();
      return;
    }
    if (footageUp) video.currentTime = 0;
    video.play().catch(() => {});
  }, [playClip, footageUp]);

  const v = stage.vectors;
  const f = stage.footage;
  // phones with little memory (2 GB or less, as the browser reports it)
  // show the clip's still picture instead of playing it
  const lowMemory = typeof navigator !== "undefined" && navigator.deviceMemory > 0 && navigator.deviceMemory <= 2;
  const clip = lowMemory ? null : covers.reel?.[0];
  const poster = covers.footage?.[0] ?? "/covers/footage.jpg";
  // the other footage cards never repeat the clip's own picture
  const fo = f.filter((src) => src !== poster);
  const run = inView && !reduced;

  return (
    <div className={`hs ${run && !held ? "is-running" : ""}`}>
      <div className="hs-side">
        <p className="home-label">How it works</p>
        <h2>Three ways to<br /><em>get it done.</em></h2>

        <ol className="hs-ways">
          {ways.map((w, i) => (
            <li key={w.n} className={i === active ? "is-on" : ""}>
              <button
                className="hs-way-head"
                onClick={() => {
                  setActive(i);
                  setHeld(true);
                }}
                aria-expanded={i === active}
              >
                <WayIcon i={i} />
                <span>{w.title}</span>
              </button>
              {/* one child, so the row folds to nothing when closed */}
              <div className="hs-way-body">
                <div>
                  <p>{w.text}</p>
                  <ol className="hs-flow">
                    {w.flow.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                  {w.cta[1].startsWith("#") ? (
                    <a href={w.cta[1]}>{w.cta[0]} →</a>
                  ) : (
                    <button className="hs-link" onClick={go(w.cta[1])}>{w.cta[0]} →</button>
                  )}
                </div>
              </div>
              {/* the line fills, then the next way takes over */}
              <span
                key={`${i}-${active}`}
                className="hs-progress"
                style={{ animationDuration: `${STEP_MS[i] ?? 7000}ms` }}
                onAnimationEnd={() => i === active && setActive((active + 1) % ways.length)}
              />
            </li>
          ))}
        </ol>
      </div>

      <div className="hs-stage" ref={stageRef} onMouseMove={onMove} onMouseLeave={onLeave}>
        {/* 01 DOWNLOAD: the store itself */}
        <div
          className={`hs-scene hs-get ${active === 0 ? "is-on" : ""}`}
          data-kind={run ? SEARCHES[phrase][1] : "vector"}
          aria-hidden={active !== 0}
        >
          {/* each search shows its own results; the others are gone */}
          {/* --i: the order the cards pop in when their search comes up */}
          <img className="hs-card hs-a is-vector" style={{ "--i": 0 }} src={v[0] ?? "/covers/vectors.jpg"} alt="" loading="lazy" />
          <img className="hs-card hs-b is-vector" style={{ "--i": 1 }} src={v[2] ?? v[0] ?? "/covers/vectors.jpg"} alt="" loading="lazy" />
          <img className="hs-card hs-c is-vector" style={{ "--i": 2 }} src={v[1] ?? "/covers/vectors.jpg"} alt="" loading="lazy" />
          <img className="hs-card hs-d is-vector" style={{ "--i": 3 }} src={v[3] ?? v[1] ?? "/covers/vectors.jpg"} alt="" loading="lazy" />

          {/* one sheet per style, each with its name */}
          {[["Glyph", "is-glyph", stage.glyphs], ["Outline", "is-outline", stage.outlines], ["Hand-drawn", "is-hand", stage.hands]]
            .filter(([, , list]) => list.length)
            .map(([name, cls, list], i) => (
              <div key={cls} className={`hs-card hs-icons ${cls} is-icon`} style={{ "--i": i }}>
                <b>{name}</b>
                {list.map((src) => <img key={src} src={src} alt="" loading="lazy" />)}
              </div>
            ))}

          <img className="hs-card hs-a is-footage" style={{ "--i": 0 }} src={fo[0] ?? poster} alt="" loading="lazy" />
          {clip ? (
            <video ref={clipRef} className="hs-card hs-b is-footage" style={{ "--i": 1 }} src={clip} poster={poster} muted loop playsInline preload="metadata" />
          ) : (
            <img className="hs-card hs-b is-footage" style={{ "--i": 1 }} src={poster} alt="" loading="lazy" />
          )}
          <img className="hs-card hs-c is-footage" style={{ "--i": 2 }} src={fo[1] ?? poster} alt="" loading="lazy" />
          <img className="hs-card hs-d is-footage" style={{ "--i": 3 }} src={fo[2] ?? fo[0] ?? poster} alt="" loading="lazy" />
          <Typing phrases={TYPED} holds={HOLDS} run={run && active === 0} onPhrase={setPhrase} />
        </div>

        {/* 02 MAKE IT YOURS: the editor as it is */}
        <div className={`hs-scene hs-edit ${active === 1 ? "is-on" : ""}`} aria-hidden={active !== 1}>
          {/* recorded in Create: the shapes picked, a color changed, the
              headline retyped; the pointer goes where the change was made */}
          <div className="hs-shot">
            <div className="hs-shot-zoom">
              <img className="hs-frame hs-f1" src="/showcase/edit-1.webp" alt="" loading="lazy" />
              <img className="hs-frame hs-f2" src="/showcase/edit-2.webp" alt="" loading="lazy" />
              <img className="hs-frame hs-f3" src="/showcase/edit-3.webp" alt="" loading="lazy" />
              <svg className="hs-pointer" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 3l14 8-6.2 1.6L10 19z" fill="#fff" stroke="#0a0b0d" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <span className="hs-chip hs-chip-b">Edit in the browser · no install</span>
        </div>

        {/* 03 A LOGO: its page recorded on the Logos library, the pointer
            trying a business card and a social profile */}
        <div className={`hs-scene hs-own ${active === 2 ? "is-on" : ""}`} aria-hidden={active !== 2}>
          <div className="hs-shot is-logo">
            <div className="hs-shot-zoom">
              {[1, 2, 3].map((n) => (
                <img key={n} className={`hs-frame hs-l${n}`} src={`/showcase/logo-${n}.webp`} alt="" loading="lazy" />
              ))}
              <svg className="hs-pointer" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 3l14 8-6.2 1.6L10 19z" fill="#fff" stroke="#0a0b0d" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomeShowcase;
