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
const STEP_MS = [7000, 9500, 8000];

// words typed into the Download stage's search bar
const SEARCHES = ["Abstract background", "Business icons", "Ocean footage"];

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

// a search bar that types one phrase after another
function Typing({ phrases, run }) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!run) return;
    let phrase = 0;
    let at = 0;
    let back = false;
    const timer = setInterval(() => {
      const word = phrases[phrase];
      if (!back) {
        at += 1;
        if (at > word.length + 18) back = true; // hold the full phrase a moment
      } else {
        at -= 2;
        if (at <= 0) {
          back = false;
          phrase = (phrase + 1) % phrases.length;
          at = 0;
        }
      }
      setText(phrases[phrase].slice(0, Math.max(0, Math.min(at, phrases[phrase].length))));
    }, 70);
    return () => clearInterval(timer);
  }, [phrases, run]);
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
  const pick = (type, field, count) =>
    supabase
      .from("assets")
      .select(field)
      .eq("type", type)
      .eq("status", "published")
      .not(field, "is", null)
      .order("downloads", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(count)
      .then(({ data }) => (data ?? []).map((row) => publicUrl(row[field])));
  const [vectors, icons] = await Promise.all([pick("vector", "thumb_key", 3), pick("icon", "thumb_key", 4)]);
  return { vectors, icons };
}

// ways: [{ n, title, text, flow, cta: [label, target] }]; covers: Home's
// store covers; go(target) opens a page; reduced: the visitor asked for less motion
function HomeShowcase({ ways, covers = {}, go }) {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false); // clicked: stays on that way
  const [stage, setStage] = useState({ vectors: [], icons: [] });
  const [inView, setInView] = useState(false);
  const stageRef = useRef(null);
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

  const v = stage.vectors;
  const clip = covers.reel?.[0];
  const poster = covers.footage?.[0] ?? "/covers/footage.jpg";
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
        <div className={`hs-scene hs-get ${active === 0 ? "is-on" : ""}`} aria-hidden={active !== 0}>
          <img className="hs-card hs-a" src={v[0] ?? "/covers/vectors.jpg"} alt="" loading="lazy" />
          {clip && run && active === 0 ? (
            <video className="hs-card hs-b" src={clip} poster={poster} autoPlay muted loop playsInline />
          ) : (
            <img className="hs-card hs-b" src={poster} alt="" loading="lazy" />
          )}
          <img className="hs-card hs-c" src={v[1] ?? covers.templates?.[0] ?? "/covers/logos.jpg"} alt="" loading="lazy" />
          <div className="hs-card hs-d">
            {(stage.icons.length ? stage.icons : ["/covers/icons.jpg"]).map((src) => (
              <img key={src} src={src} alt="" loading="lazy" />
            ))}
          </div>
          <Typing phrases={SEARCHES} run={run && active === 0} />
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
            trying it on dark, a business card and a social profile */}
        <div className={`hs-scene hs-own ${active === 2 ? "is-on" : ""}`} aria-hidden={active !== 2}>
          <div className="hs-shot is-logo">
            <div className="hs-shot-zoom">
              {[1, 2, 3, 4].map((n) => (
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
