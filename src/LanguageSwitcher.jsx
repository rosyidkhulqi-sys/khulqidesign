import { useState } from "react";

export default function LanguageSwitcher({ language, setLanguage }) {
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: "EN", label: "English" },
    { code: "ES", label: "Español" },
    { code: "DE", label: "Deutsch" },
    { code: "FR", label: "Français" },
    { code: "PT", label: "Português" },
    { code: "JP", label: "日本語" },
    { code: "KR", label: "한국어" },
    { code: "ID", label: "Bahasa Indonesia" },
  ];

  return (
    <div className="language-switcher">
      <button
        className="language-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        🌐 {language} ▼
      </button>

      {isOpen && (
        <div className="language-dropdown">
          {languages.map((lang) => (
            <div
              key={lang.code}
              className="language-item"
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
            >
              {lang.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}