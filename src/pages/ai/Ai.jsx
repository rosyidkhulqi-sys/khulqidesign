// The AI page: Khulqidesign as a stock library with AI tools on top, a
// simpler take on Magnific and Envato. Every tool starts from our own
// assets. The tools call lib/ai.js; until the AI backend is ready they are
// shown as "Coming soon" and the prompt can't be sent.
import { useState } from "react";
import "../vectors/Vectors.css";
import "./Ai.css";
import Breadcrumb from "../../components/Breadcrumb";
import { Sparkle } from "../../components/AiSearchButton";
import { aiReady } from "../../lib/ai";
import AnimateIcon from "./AnimateIcon";

// tools that already work in the browser, without the AI backend
const ready = new Set(["animate"]);

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
  ["animate", "Animate an icon", "Turn a flat or outline icon into a Lottie, GIF or MP4 animation.", ["Icons"]],
  ["template", "Template from text", "Describe a post or poster; AI fills one of our templates with your words and colors.", ["Templates"]],
  ["video", "Image to video", "Bring a vector or still frame to life as a short clip.", ["Vectors", "Footage"]],
  ["image", "Generate an image", "New artwork in the style of our vector collections.", ["Vectors"]],
  ["edit", "Edit an image", "Change colors, swap parts or extend a picture.", ["Vectors"]],
  ["cutout", "Remove background", "Cut the subject out of a photo or illustration.", ["Create"]],
  ["upscale", "Upscale", "Enlarge a picture or frame without losing sharpness.", ["Vectors", "Footage"]],
];

function Glyph({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyphs[name]}
    </svg>
  );
}

function Ai({ setPage }) {
  const [kind, setKind] = useState("image");
  const [prompt, setPrompt] = useState("");
  // the tool open in full, or null for the overview
  const [tool, setTool] = useState(null);

  if (tool === "animate") {
    return (
      <section className="vectors-page ai-page">
        <div className="library-head">
          <Breadcrumb setPage={setPage} parent={{ label: "AI", onClick: () => setTool(null) }} current="Animate an icon" />
          <h1>
            Animate an icon <span className="library-count">Motion presets, live preview</span>
          </h1>
        </div>
        <AnimateIcon />
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
      <form className="ai-prompt" onSubmit={(e) => e.preventDefault()}>
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
          <button type="submit" className="ai-generate" disabled={!aiReady || !prompt.trim()}>
            Generate
          </button>
        </div>
        {!aiReady && (
          <p className="ai-note">
            <span className="ai-soon">Coming soon</span>
            AI tools open once your account and credits are live.
          </p>
        )}
      </form>

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
    </section>
  );
}

export default Ai;
