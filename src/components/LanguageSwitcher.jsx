import { useEffect, useRef, useState } from "react";
import "./LanguageSwitcher.css";

const languages = [
  { code: "EN", label: "English" },
  { code: "ID", label: "Bahasa Indonesia" },
  { code: "ES", label: "Español" },
  { code: "DE", label: "Deutsch" },
  { code: "FR", label: "Français" },
  { code: "PT", label: "Português" },
  { code: "JP", label: "日本語" },
  { code: "KR", label: "한국어" },
];

export default function LanguageSwitcher({ language, setLanguage }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const current = languages.find((l) => l.code === language) ?? languages[0];

  // close on a click outside or on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e) => !ref.current?.contains(e.target) && setIsOpen(false);
    const onKey = (e) => e.key === "Escape" && setIsOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <div className="language-switcher" ref={ref}>
      <button
        className={`language-btn ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <svg className="language-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
        {current.label}
        <svg className="language-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>

      {isOpen && (
        <ul className="language-dropdown" role="listbox" aria-label="Language">
          {languages.map((lang) => (
            <li key={lang.code}>
              <button
                role="option"
                aria-selected={lang.code === current.code}
                className={lang.code === current.code ? "selected" : ""}
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
              >
                <span>{lang.label}</span>
                <small>{lang.code}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
