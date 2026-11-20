// Logo maker (prototype, admins): a brand name, what the brand does, a style
// and colors become a dozen logos, each a symbol from OUR icon library set
// with a curated font pair in one of four layouts. Nothing comes from outside
// the library, so every logo stays in the Khulqidesign style. A chosen logo
// opens in Create as an editable design (the symbol as vector shapes).
//
// Later: mascots from the mascot library, AI picking symbols and names, a
// brand kit and the logo placed on business cards and posts.
import { useEffect, useMemo, useState } from "react";
import "./LogoMaker.css";
import TemplateThumb from "../../components/TemplateThumb";
import { supabase } from "../../lib/supabaseClient";
import { publicUrl } from "../../lib/r2";
import { loadFont } from "../create/createFonts";

const W = 1080;

const STYLES = [
  ["auto", "Auto"],
  ["logogram", "Logogram"],
  ["emblem", "Emblem"],
  ["wordmark", "Wordmark"],
  ["mascot", "Mascot"],
];
const LAYOUTS = { auto: ["stacked", "inline", "badge", "wordmark"], logogram: ["stacked", "inline"], emblem: ["badge"], wordmark: ["wordmark"] };

// the brand's palettes: ground, symbol, accent, text, quiet text
const PALETTES = [
  { name: "Ink", bg: "#FFFFFF", main: "#141414", accent: "#E4412F", text: "#141414", muted: "#77736B" },
  { name: "Bauhaus", bg: "#F2EDE4", main: "#1D4E9E", accent: "#F3B61F", text: "#141414", muted: "#6B665D" },
  { name: "Night", bg: "#141414", main: "#F3B61F", accent: "#E4412F", text: "#F2EDE4", muted: "#A8A39A" },
  { name: "Forest", bg: "#FFFFFF", main: "#1F6F54", accent: "#E9B949", text: "#183D30", muted: "#5E7A6F" },
  { name: "Violet", bg: "#F6F3FF", main: "#5B3FD1", accent: "#FF7A59", text: "#231A4D", muted: "#6E6596" },
  { name: "Coral", bg: "#FFF8F2", main: "#D7263D", accent: "#1B998B", text: "#2B2B2B", muted: "#7A6F69" },
];

// curated pairs from Create's fonts: name font (and weight), tagline font
const FONTS = [
  ["Archivo Black", 400, "Work Sans"],
  ["DM Serif Display", 400, "DM Sans"],
  ["Montserrat", 800, "Montserrat"],
  ["Playfair Display", 700, "Lato"],
  ["Space Grotesk", 700, "Inter"],
  ["Outfit", 700, "Outfit"],
  ["Bebas Neue", 400, "Work Sans"],
  ["Righteous", 400, "Poppins"],
  ["Fredoka", 600, "Nunito"],
  ["Instrument Serif", 400, "Inter"],
];

// the symbol in one color, so it takes the palette
function tint(svg, color) {
  let out = svg
    .replace(/fill="(?!none)[^"]*"/gi, `fill="${color}"`)
    .replace(/stroke="(?!none)[^"]*"/gi, `stroke="${color}"`)
    .replace(/fill:\s*(?!none)[^;"]+/gi, `fill:${color}`)
    .replace(/stroke:\s*(?!none)[^;"]+/gi, `stroke:${color}`);
  const root = out.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  if (root && !/\sfill=/.test(root)) out = out.replace(root, root.replace(/<svg\b/i, `<svg fill="${color}"`));
  return out;
}

// a name's size, so long names still fit their line
// (wide fonts need room: `per` is how many letter widths fit the size)
const fit = (name, widthPx, max, per = 1.75) => Math.round(Math.max(44, Math.min(max, (widthPx / Math.max(4, name.length)) * per)));

function scene(layout, { name, tagline, svg, multi, palette: p, fonts: [nameFont, weight, tagFont] }) {
  const el = [];
  const paint = (color) => (multi ? svg : tint(svg, color));
  const tag = tagline ? tagline.toUpperCase() : "";
  if (layout === "stacked") {
    el.push({ type: "svg", svg: paint(p.main), x: 390, y: 210, w: 300, h: 300 });
    el.push({ type: "text", text: name, x: 40, y: 560, w: 1000, size: fit(name, 1000, 120), font: nameFont, weight, fill: p.text, align: "center", lineHeight: 1 });
    if (tag) el.push({ type: "text", text: tag, x: 90, y: 720, w: 900, size: 30, font: tagFont, weight: 500, fill: p.muted, align: "center", letterSpacing: 6 });
  }
  if (layout === "inline") {
    el.push({ type: "svg", svg: paint(p.main), x: 120, y: 410, w: 240, h: 240 });
    el.push({ type: "text", text: name, x: 400, y: 430, w: 620, size: fit(name, 620, 104), font: nameFont, weight, fill: p.text, align: "left", lineHeight: 1 });
    if (tag) el.push({ type: "text", text: tag, x: 404, y: 570, w: 600, size: 26, font: tagFont, weight: 500, fill: p.muted, align: "left", letterSpacing: 5 });
  }
  if (layout === "badge") {
    if (multi) {
      // a colored element sits inside a ring, on the ground, in its own colors
      el.push({ type: "circle", x: 330, y: 170, r: 210, fill: "transparent", stroke: p.main, strokeWidth: 12 });
    } else {
      el.push({ type: "circle", x: 330, y: 170, r: 210, fill: p.main });
      el.push({ type: "circle", x: 346, y: 186, r: 194, fill: "transparent", stroke: p.bg, strokeWidth: 6 });
    }
    el.push({ type: "svg", svg: paint(p.bg), x: 410, y: 250, w: 260, h: 260 });
    el.push({ type: "text", text: name, x: 40, y: 640, w: 1000, size: fit(name, 1000, 96), font: nameFont, weight, fill: p.main, align: "center", lineHeight: 1 });
    if (tag) el.push({ type: "text", text: tag, x: 90, y: 780, w: 900, size: 28, font: tagFont, weight: 500, fill: p.muted, align: "center", letterSpacing: 6 });
  }
  if (layout === "wordmark") {
    el.push({ type: "text", text: name, x: 40, y: 430, w: 1000, size: fit(name, 1000, 130, 1.3), font: nameFont, weight, fill: p.text, align: "center", lineHeight: 1 });
    el.push({ type: "rect", x: 470, y: 600, w: 140, h: 10, r: 5, fill: p.accent });
    if (tag) el.push({ type: "text", text: tag, x: 90, y: 650, w: 900, size: 30, font: tagFont, weight: 500, fill: p.muted, align: "center", letterSpacing: 8 });
  }
  return { w: W, h: W, bg: p.bg, elements: el };
}

// symbols for what the brand does: icons whose title or keywords match,
// topped up with the most used ones
// Symbols come from icons and Create elements (SVG ones): the words of
// "what it does" are matched against their titles and keywords.
async function findSymbols(about) {
  const words = about.trim().toLowerCase().split(/[\s,]+/).map((w) => w.replace(/[^a-z0-9-]/g, "")).filter((w) => w.length > 1).slice(0, 3);
  const base = () => supabase
    .from("assets")
    .select("code, title, thumb_key, type")
    .in("type", ["icon", "element"])
    .eq("status", "published")
    .ilike("thumb_key", "%.svg");
  let rows = [];
  if (words.length) {
    const any = words.flatMap((w) => [`title.ilike.%${w}%`, `keywords.cs.{${w}}`]).join(",");
    const { data } = await base().or(any).limit(10);
    rows = data ?? [];
  }
  if (rows.length < 4) {
    const { data } = await base().eq("type", "icon").order("downloads", { ascending: false }).limit(8);
    rows = [...rows, ...(data ?? []).filter((r) => !rows.some((x) => x.code === r.code))].slice(0, 10);
  }
  const svgs = await Promise.all(rows.map((r) => fetch(publicUrl(r.thumb_key)).then((res) => res.text()).catch(() => null)));
  // an element keeps its own colors (one color would lose its detail)
  return rows.map((r, i) => ({ code: r.code, title: r.title, svg: svgs[i], multi: r.type === "element" })).filter((s) => s.svg && /<svg/i.test(s.svg));
}

function LogoMaker({ onOpen }) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [style, setStyle] = useState("auto");
  const [palette, setPalette] = useState(-1); // -1: a mix
  const [symbols, setSymbols] = useState([]);
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [error, setError] = useState(null);

  // every font the logos may use, ready before they're drawn
  useEffect(() => {
    [...new Set(FONTS.flatMap(([a, , b]) => [a, b]))].forEach((f) => loadFont(f));
  }, []);

  const generate = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    setChosen(null);
    try {
      const found = await findSymbols(about || name);
      if (!found.length) throw new Error("No symbols found in the library. Try another word for what the brand does.");
      setSymbols(found);
      setSeed((s) => s + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // a dozen logos: symbols, layouts, palettes and fonts in turn
  const logos = useMemo(() => {
    if (!symbols.length || !name.trim()) return [];
    const layouts = LAYOUTS[style] ?? LAYOUTS.auto;
    return Array.from({ length: 12 }, (_, i) => {
      const layout = layouts[i % layouts.length];
      const symbol = symbols[(i + seed) % symbols.length];
      const p = PALETTES[palette >= 0 ? palette : (i + seed * 2) % PALETTES.length];
      const fonts = FONTS[(i * 3 + seed) % FONTS.length];
      return { id: `${seed}-${i}`, layout, symbol, scene: scene(layout, { name: name.trim(), tagline: tagline.trim(), svg: symbol.svg, multi: symbol.multi, palette: p, fonts }) };
    });
  }, [symbols, seed, style, palette, name, tagline]);

  return (
    <div className="lg">
      {/* not a <form>: the AI page's prompt box already is one */}
      <div className="lg-form" onKeyDown={(e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); generate(); } }}>
        <label>
          <span>Brand name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Brand" maxLength={28} />
        </label>
        <label>
          <span>Tagline <em>optional</em></span>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Coffee roasters" maxLength={40} />
        </label>
        <label>
          <span>What it does</span>
          <input value={about} onChange={(e) => setAbout(e.target.value)} placeholder="coffee, finance, travel…" maxLength={30} />
        </label>
        <button type="button" className="lg-go" onClick={() => generate()} disabled={busy || !name.trim()}>{busy ? "Making…" : logos.length ? "Make again" : "Make logos"}</button>
      </div>

      <div className="lg-row">
        <span>Style</span>
        {STYLES.map(([id, label]) => (
          <button key={id} type="button" className={style === id ? "on" : ""} disabled={id === "mascot"}
                  title={id === "mascot" ? "Comes with the mascot library" : undefined} onClick={() => setStyle(id)}>
            {label}{id === "mascot" && <small> soon</small>}
          </button>
        ))}
      </div>
      <div className="lg-row">
        <span>Colors</span>
        <button type="button" className={palette < 0 ? "on" : ""} onClick={() => setPalette(-1)}>Mix</button>
        {PALETTES.map((p, i) => (
          <button key={p.name} type="button" className={`lg-swatch ${palette === i ? "on" : ""}`} onClick={() => setPalette(i)} title={p.name}>
            <i style={{ background: p.bg }} /><i style={{ background: p.main }} /><i style={{ background: p.accent }} />
          </button>
        ))}
      </div>

      {error && <p className="lg-error">{error}</p>}

      {logos.length > 0 && (
        <>
          <div className="lg-grid">
            {logos.map((l) => (
              <button key={l.id} type="button" className={`lg-card ${chosen?.id === l.id ? "on" : ""}`} onClick={() => setChosen(l)}
                      aria-label={`${l.layout} logo with ${l.symbol.title}`}>
                <TemplateThumb scene={l.scene} />
              </button>
            ))}
          </div>
          <div className="lg-bar">
            <button type="button" onClick={() => setSeed((s) => s + 1)}>Shuffle</button>
            <span>{chosen ? `${chosen.layout} · symbol: ${chosen.symbol.title}` : "Pick a logo to edit it"}</span>
            <button type="button" className="lg-go" disabled={!chosen}
                    onClick={() => onOpen?.({ title: `${name.trim()} logo`, scene: chosen.scene })}>
              Edit in Create
            </button>
          </div>
        </>
      )}

      <p className="lg-note">
        Admin prototype: symbols come from our icon library, fonts from Create&apos;s curated pairs, so every logo stays in
        the Khulqidesign style. Mascots join when the mascot library is in.
      </p>
    </div>
  );
}

export default LogoMaker;
