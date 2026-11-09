// The fonts in Create. Every web font here is from Google Fonts and was checked
// to carry the SIL Open Font License, which allows commercial use, also inside
// a paid product. Add only OFL fonts (github.com/google/fonts, folder ofl/).
// Google serves the files, so we don't redistribute them, and a font file must
// never be sold or offered for download on its own.
// A font's files only download once a design or the font list shows it.

const GOOGLE = [
  { name: "Sans", fonts: [
    "Space Grotesk", "DM Sans", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat",
    "Poppins", "Raleway", "Nunito", "Work Sans", "Rubik", "Manrope", "Outfit",
    "Plus Jakarta Sans", "Figtree", "Karla", "Mulish", "Barlow", "Oswald", "Archivo",
    "Quicksand",
  ] },
  { name: "Serif", fonts: [
    "Instrument Serif", "Playfair Display", "Merriweather", "Lora", "PT Serif",
    "Libre Baskerville", "Cormorant Garamond", "EB Garamond", "DM Serif Display",
    "Crimson Text", "Bitter",
  ] },
  { name: "Display", fonts: [
    "Bebas Neue", "Anton", "Abril Fatface", "Alfa Slab One", "Lobster", "Righteous", "Bungee",
    "Fredoka", "Archivo Black", "Titan One", "Staatliches", "Comfortaa", "Baloo 2",
  ] },
  { name: "Script", fonts: [
    "Pacifico", "Dancing Script", "Great Vibes", "Sacramento", "Caveat", "Kaushan Script",
    "Shadows Into Light", "Amatic SC", "Parisienne", "Allura",
  ] },
  { name: "Mono", fonts: [
    "Roboto Mono", "JetBrains Mono", "Space Mono", "IBM Plex Mono", "Courier Prime",
  ] },
];

// not ours to serve: each visitor's device supplies these, and looks may differ
const SYSTEM = ["Arial", "Helvetica", "Georgia", "Times New Roman", "Courier New", "Verdana", "Impact"];

export const fontGroups = [...GOOGLE, { name: "On your device", fonts: SYSTEM }];

// already linked for the whole site in index.html
const SITE_FONTS = ["Space Grotesk", "DM Sans", "Instrument Serif"];

const webFonts = new Set(GOOGLE.flatMap((g) => g.fonts));

const sheetUrl = () => {
  const families = [...webFonts]
    .filter((f) => !SITE_FONTS.includes(f))
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;700`);
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
};

let sheet;

// the stylesheet only names the fonts; no font file downloads because of it
export function linkFonts() {
  sheet ??= new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = sheetUrl();
    link.onload = resolve;
    // without it the text falls back to a system font; the editor keeps working
    link.onerror = resolve;
    document.head.appendChild(link);
  });
  return sheet;
}

// the canvas measures and draws text once, so a font has to arrive first
export async function loadFont(name) {
  if (!webFonts.has(name)) return;
  if (!SITE_FONTS.includes(name)) await linkFonts();
  await Promise.all([400, 700].map((w) => document.fonts.load(`${w} 40px "${name}"`))).catch(() => {});
}

export const loadSiteFonts = () => Promise.all(SITE_FONTS.map(loadFont));

// every font a saved design uses
export function loadFontsOf(design) {
  const text = typeof design === "string" ? design : JSON.stringify(design);
  const names = new Set([...text.matchAll(/fontFamily\\*":\\*"([^"\\]+)/g)].map((m) => m[1]));
  return Promise.all([...names].map(loadFont));
}
