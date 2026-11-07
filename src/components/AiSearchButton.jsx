// The ✨ button in the library search bars. Until the AI backend is ready it
// opens a short note saying what AI search will do.
import { useEffect, useRef, useState } from "react";
import { aiReady } from "../lib/ai";
import "./AiSearchButton.css";

export function Sparkle({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z" />
      <path d="M18 14.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" />
    </svg>
  );
}

function AiSearchButton({ example }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  // close on a click outside or Escape
  useEffect(() => {
    if (!open) return;
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="ai-search" ref={box}>
      <button
        type="button"
        className={`ai-search-button ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Search with AI"
        title="Search with AI"
      >
        <Sparkle />
      </button>

      {open && (
        <div className="ai-search-pop" role="dialog" aria-label="Search with AI">
          <strong>
            <Sparkle size={16} /> Search with AI
            {!aiReady && <span className="ai-soon">Coming soon</span>}
          </strong>
          <p>
            Describe what you need in your own words, like <em>“{example}”</em>,
            and AI finds the right assets from our library.
          </p>
        </div>
      )}
    </div>
  );
}

export default AiSearchButton;
