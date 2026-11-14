// The picture on top of each free AI tool card, made by the tools themselves:
// a before / after line sweeping across a real Remove background result and a
// real 4× Upscale (both made on the AI page), and a library icon moving with
// the Animate studio's own motion. Still for visitors who ask for less motion.
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { publicUrl } from "../../lib/r2";
import { motionStyles } from "../../lib/animateMotion";
import "./HomeAiDemo.css";

const MOTIONS = ["bounce", "swing", "pulse", "spin"];
const INKS = ["#E5233A", "#2D6CDF", "#17A398", "#F5B700"];

// a before / after pair, the line sweeping between them
function Compare({ before, after, labels, className = "" }) {
  return (
    <span className={`ha-compare ${className}`} aria-hidden="true">
      <img className="ha-before" src={before} alt="" loading="lazy" />
      <span className="ha-after">
        <img src={after} alt="" loading="lazy" />
      </span>
      <i className="ha-line" />
      <b className="ha-tag ha-tag-before">{labels[0]}</b>
      <b className="ha-tag ha-tag-after">{labels[1]}</b>
    </span>
  );
}

// an icon's SVG made safe to put inline (from our own store, but scripts and
// handlers never belong in an icon)
function cleanSvg(text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return null;
  svg.querySelectorAll("script, foreignObject").forEach((n) => n.remove());
  svg.querySelectorAll("*").forEach((n) =>
    [...n.attributes].forEach((a) => /^on/i.test(a.name) && n.removeAttribute(a.name)));
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  return svg.outerHTML;
}

function AnimateDemo() {
  const [markup, setMarkup] = useState(null);
  const [turn, setTurn] = useState(0);
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // the library's most downloaded icon
  useEffect(() => {
    let alive = true;
    supabase
      .from("assets")
      .select("thumb_key")
      .eq("type", "icon")
      .eq("status", "published")
      .order("downloads", { ascending: false })
      .limit(1)
      .then(({ data }) => (data?.[0] ? fetch(publicUrl(data[0].thumb_key)).then((r) => r.text()) : null))
      .then((text) => alive && text && setMarkup(cleanSvg(text)))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // a new move and color every few seconds
  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => setTurn((t) => t + 1), 2600);
    return () => clearInterval(timer);
  }, [still]);

  const motion = MOTIONS[turn % MOTIONS.length];
  const css = still
    ? ""
    : motionStyles(motion, { duration: 1.1, loop: true, easing: "smooth", pause: 0.4, sel: { icon: ".ha-icon" }, d: (p) => `${p}%`, name: `ha-${motion}` });
  return (
    <span className="ha-animate" aria-hidden="true">
      <style>{css}</style>
      {markup && <span className="ha-icon" style={{ color: INKS[turn % INKS.length] }} dangerouslySetInnerHTML={{ __html: markup }} />}
      <b className="ha-tag ha-tag-motion">{motion}</b>
    </span>
  );
}

// tool: 0 Remove background, 1 Upscale, 2 Animate
function HomeAiDemo({ tool }) {
  if (tool === 0) {
    return (
      <Compare
        className="is-cutout"
        before="/showcase/ai-cutout-before.webp"
        after="/showcase/ai-cutout-after.webp"
        labels={["Original", "Transparent PNG"]}
      />
    );
  }
  if (tool === 1) {
    return (
      <Compare
        className="is-upscale"
        before="/showcase/ai-upscale-before.webp"
        after="/showcase/ai-upscale-after.webp"
        labels={["250 px", "4× · 1000 px"]}
      />
    );
  }
  return <AnimateDemo />;
}

export default HomeAiDemo;
