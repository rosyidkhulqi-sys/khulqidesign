// A library's cover: its picture, or a simple drawn glyph on its color for a
// library that has no cover picture yet (Photos, Mockups).
const glyphs = {
  photo: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="12" width="36" height="26" rx="4" />
      <path d="M17 12l3-5h8l3 5" />
      <circle cx="24" cy="25" r="7" />
    </svg>
  ),
  mockup: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="9" width="30" height="21" rx="3" />
      <path d="M14 37h12M20 30v7" />
      <rect x="31" y="18" width="12" height="21" rx="3" />
    </svg>
  ),
};

function LibraryCover({ library, className = "" }) {
  // footage: its picture with a small play sign, so it reads as video
  if (library.image && library.play) {
    return (
      <span className={`library-cover-play ${className}`}>
        <img src={library.image} alt="" loading="lazy" />
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.55)" /><path d="M10 8l6 4-6 4z" fill="#fff" /></svg>
      </span>
    );
  }
  if (library.image) return <img className={className} src={library.image} alt="" loading="lazy" />;
  return (
    <span className={`library-glyph ${className}`} style={{ background: library.tint }}>
      {glyphs[library.glyph]}
    </span>
  );
}

export default LibraryCover;
