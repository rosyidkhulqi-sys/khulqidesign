// The AI page: Khulqidesign as a stock library with AI tools on top, a
// simpler take on Magnific and Envato. Every tool starts from our own
// assets. The tools call lib/ai.js; until the AI backend is ready they are
// shown as "Coming soon" and the prompt can't be sent.
import { useEffect, useState } from "react";
import "../vectors/Vectors.css";
import "./Ai.css";
import Breadcrumb from "../../components/Breadcrumb";
import { Sparkle } from "../../components/AiSearchButton";
import { aiReady } from "../../lib/ai";
import { briefPayload, emptyBrief, generateTemplate } from "../../lib/aiTemplate";
import { supabase } from "../../lib/supabaseClient";
import { loadFont } from "../create/createFonts";
import TemplateThumb from "../../components/TemplateThumb";
import TemplateBrief from "./TemplateBrief";
import AnimateIcon from "./AnimateIcon";
import ImageTool from "./ImageTool";
import { keptAnimate, keptTool } from "../../lib/aiKeep";
import { MODELS, UPSCALE_MAX_SIDE, removeBackground, upscale } from "../../lib/aiLocal";

// tools that already work in the browser, without the AI backend
const ready = new Set(["animate", "cutout", "upscale"]);

// in-browser image tools: free to run, no account needed
const imageTools = {
  cutout: {
    title: "Remove background",
    sub: "Cut out the subject, on your device",
    run: removeBackground,
    suffix: "no-background",
    modelMb: MODELS.cutout.mb,
    hint: "Works best on a clear subject: a product, a person, an illustration.",
  },
  upscale: {
    title: "Upscale",
    sub: "2× or 4× bigger, with AI detail",
    run: upscale,
    suffix: "upscaled",
    options: [[2, "2×"], [4, "4×"]],
    modelMb: MODELS.upscale.mb,
    hint: `Pictures larger than ${UPSCALE_MAX_SIDE} px are scaled down first; a large picture takes about a minute.`,
  },
};

const kinds = [
  ["image", "Image"],
  ["video", "Video"],
  ["template", "Template"],
  ["animation", "Animation"],
];

// a line icon per tool, in the site's 24px / 1.8 stroke style
const glyphs = {
  animate: <><path d="M5 19c3-1 4-4 4-7s1-6 4-7" /><circle cx="17" cy="7" r="3" /><path d="M14 17h6M17 14v6" /></>,
  template: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h5M8 16h3" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  cutout: <><circle cx="12" cy="9" r="4" /><path d="M5 21c1-4 4-6 7-6s6 2 7 6" /><path d="M3 3l3 3M21 3l-3 3" /></>,
  upscale: <><path d="M4 14v6h6M20 10V4h-6" /><path d="M4 20l7-7M20 4l-7 7" /></>,
};

const tools = [
  ["animate", "Animate an icon", "Turn an icon into a Lottie, GIF, MP4 or animated SVG, right in your browser.", ["Icons"]],
  ["template", "Template from text", "Describe a post or poster; AI fills one of our templates with your words and colors.", ["Templates"]],
  ["video", "Image to video", "Bring a vector or still frame to life as a short clip.", ["Vectors", "Footage"]],
  ["image", "Generate an image", "New artwork in the style of our vector collections.", ["Vectors"]],
  ["edit", "Edit an image", "Change colors, swap parts or extend a picture.", ["Vectors"]],
  ["cutout", "Remove background", "Cut the subject out of a photo or illustration. Free, on your device.", ["Your pictures"]],
  ["upscale", "Upscale", "Enlarge a picture 2× or 4× without losing sharpness. Free, on your device.", ["Your pictures"]],
];

function Glyph({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyphs[name]}
    </svg>
  );
}

// animateIcon: set when "Animate" was clicked on an icon's detail view; the
// studio then opens straight away with that icon
// openInCreate(template): opens a design in Create as a new project
function Ai({ setPage, user = null, animateIcon = null, openInCreate }) {
  const [kind, setKind] = useState("image");
  const [prompt, setPrompt] = useState("");
  // Template from text is on for admins while it's being tried out
  const [isAdmin, setIsAdmin] = useState(false);
  // { busy } while Claude designs, then { template, usage } or { error }
  const [made, setMade] = useState(null);
  const [brief, setBrief] = useState(emptyBrief);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase.rpc("is_admin").then(({ data }) => alive && setIsAdmin(data === true));
    return () => {
      alive = false;
    };
  }, [user]);

  const templateOpen = isAdmin && kind === "template";
  const canGenerate = (aiReady || templateOpen) && prompt.trim() && !made?.busy;

  const generate = async (e) => {
    e.preventDefault();
    if (!templateOpen || !prompt.trim() || made?.busy) return;
    setMade({ busy: true });
    try {
      const result = await generateTemplate(prompt.trim(), briefPayload(brief));
      // the preview needs the design's fonts, as Create does
      await Promise.all(
        [...new Set(result.template.scene.elements.map((el) => el.font).filter(Boolean))].map(loadFont)
      );
      setMade(result);
    } catch (err) {
      setMade({ error: err.message });
    }
  };
  // the tool open in full, or null for the overview
  // a result kept while the visitor logged in reopens its tool
  const [tool, setTool] = useState(animateIcon ? "animate" : keptTool() ?? (keptAnimate() ? "animate" : null));

  if (imageTools[tool]) {
    const t = imageTools[tool];
    return (
      <section className="vectors-page ai-page">
        <div className="library-head">
          <Breadcrumb setPage={setPage} parent={{ label: "AI", onClick: () => setTool(null) }} current={t.title} />
          <h1>
            {t.title} <span className="library-count">{t.sub}</span>
          </h1>
        </div>
        <ImageTool key={tool} tool={tool} run={t.run} suffix={t.suffix} options={t.options} modelMb={t.modelMb} hint={t.hint}
                   user={user} />
      </section>
    );
  }

  if (tool === "animate") {
    return (
      <section className="vectors-page ai-page">
        <div className="library-head">
          <Breadcrumb setPage={setPage} parent={{ label: "AI", onClick: () => setTool(null) }} current="Animate an icon" />
          <h1>
            Animate an icon <span className="library-count">Motion presets, live preview</span>
          </h1>
        </div>
        <AnimateIcon initialIcon={animateIcon} user={user} setPage={setPage} />
      </section>
    );
  }

  return (
    <section className="vectors-page ai-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="AI" />
        <h1>
          Khulqidesign AI <span className="library-count">Create from our library</span>
        </h1>
      </div>

      {/* one prompt for every tool, as on Magnific */}
      <form className="ai-prompt" onSubmit={generate}>
        <div className="ai-kinds" role="radiogroup" aria-label="What to create">
          {kinds.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={kind === id}
              className={kind === id ? "active" : ""}
              onClick={() => setKind(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ai-prompt-row">
          <Sparkle size={20} />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to create, like “a Ramadan sale poster in green and gold”"
            aria-label="Describe what you want to create"
          />
          <button type="submit" className="ai-generate" disabled={!canGenerate}>
            {made?.busy ? "Designing…" : "Generate"}
          </button>
        </div>
        {templateOpen && <TemplateBrief brief={brief} onChange={setBrief} />}
        {templateOpen && !made && (
          <p className="ai-note">
            <span className="ai-soon ai-trial">Admin trial</span>
            Claude designs an editable template from your words. It takes about half a minute.
          </p>
        )}
        {!aiReady && !templateOpen && (
          <p className="ai-note">
            <span className="ai-soon">Coming soon</span>
            AI tools open once your account and credits are live.
          </p>
        )}
      </form>

      {/* the design Claude made: look first, then open it in Create */}
      {made && (
        <div className="ai-result" aria-live="polite">
          {made.busy && (
            <div className="ai-result-wait">
              <span className="ai-spinner" aria-hidden="true" />
              Designing your template…
            </div>
          )}
          {made.error && <p className="ai-result-error" role="alert">{made.error}</p>}
          {made.template && (
            <>
              <div
                className="ai-result-preview"
                style={{ aspectRatio: `${made.template.scene.w} / ${made.template.scene.h}` }}
              >
                <TemplateThumb scene={made.template.scene} />
              </div>
              <div className="ai-result-side">
                <strong>{made.template.title}</strong>
                <span className="ai-result-meta">
                  {made.template.scene.w} × {made.template.scene.h} px · {made.template.scene.elements.length} parts, all editable
                </span>
                <button
                  className="ai-generate"
                  onClick={() => {
                    // logged as used: the designs people keep are the ones to learn from
                    if (made.id) supabase.rpc("mark_generation_opened", { generation: made.id }).then(() => {});
                    openInCreate?.(made.template);
                  }}
                >
                  Open in Create
                </button>
                <button className="ai-again" onClick={generate}>Generate again</button>
                {made.usage && (
                  <span className="ai-result-meta">
                    {made.usage.seconds} s · {made.usage.passes} pass{made.usage.passes > 1 ? "es" : ""} ·{" "}
                    {made.usage.input + made.usage.cached} in ({made.usage.cached} cached) · {made.usage.output} out ·{" "}
                    ${made.usage.costUsd?.toFixed(3)}
                  </span>
                )}
                {made.checks?.found?.length > 0 && (
                  <span className="ai-result-meta">
                    Layout check: {made.checks.found.length} issue{made.checks.found.length > 1 ? "s" : ""} found
                    {made.checks.fixed ? `, ${made.checks.left.length} left after the fix` : ", not fixed"}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <p className="ai-section">AI tools</p>
      <div className="ai-tools">
        {tools.map(([id, name, text, from]) => {
          const open = ready.has(id);
          const body = (
            <>
              <span className="ai-tool-icon"><Glyph name={id} /></span>
              <strong>{name}</strong>
              {open ? (
                <span className="ai-soon ai-try">Try it</span>
              ) : (
                !aiReady && <span className="ai-soon">Coming soon</span>
              )}
              <p>{text}</p>
              <span className="ai-from">Uses {from.join(" · ")}</span>
            </>
          );
          // tools that work now open; the rest are a description for now
          return open ? (
            <button key={id} className="ai-tool is-open" onClick={() => { setTool(id); window.scrollTo(0, 0); }}>
              {body}
            </button>
          ) : (
            <div key={id} className="ai-tool">{body}</div>
          );
        })}
      </div>

      <p className="ai-foot">
        Every tool starts from the Khulqidesign library, so results match our styles and come
        with a clear license.
      </p>
      {/* open-source models: their licenses ask for this notice */}
      <p className="ai-foot ai-credits">
        Remove background uses Silueta, based on U²-Net (Apache License 2.0). Upscale uses
        Real-ESRGAN general x4v3, © 2021 Xintao Wang (BSD 3-Clause License).
      </p>
    </section>
  );
}

export default Ai;
