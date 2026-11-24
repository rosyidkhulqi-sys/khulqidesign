// Fonts: the owner's own typefaces, sold per item at a price per license
// tier, as on Creative Market and MyFonts (not part of the subscription).
// The cards show a specimen drawn from the font; the font file stays private.
import StockLibrary from "../stock/StockLibrary";
import { FONT_CATEGORIES } from "../../data/fontCategories";

const TIERS = [
  ["desktop", "Desktop", "Print, logos, images and video · installed on up to 5 computers"],
  ["web", "Web", "One website with @font-face (WOFF2) · up to 500k views a month"],
  ["app", "App & ebook", "Embedded in one app or ebook"],
  ["extended", "Extended", "Products for sale: merchandise, templates, packaging"],
];

const label = (id) => FONT_CATEGORIES.find(([c]) => c === id)?.[1] ?? "Other";

const config = {
  type: "font",
  page: "fonts",
  title: "Fonts",
  noun: ["font", "fonts"],
  kindWords: ["font", "fonts", "typeface", "typefaces"],
  placeholder: "Search fonts, display, serif, script...",
  aiExample: "A bold geometric font for a coffee brand",
  categories: FONT_CATEGORIES,
  categoryLabel: label,
  // sold per item: no Free/Premium, license or orientation filters
  paid: true,
  formatLabel: () => "OTF · TTF · WOFF2",
  options: (f) => TIERS
    .filter(([id]) => f.prices?.[id])
    .map(([id, name, detail]) => ({ label: name, detail, size: `$${f.prices[id]}`, price: f.prices[id], tier: id })),
  specs: (f) => [
    ["Files", (f.files?.[0]?.contents ?? []).join(", ") || "OTF, TTF, WOFF2"],
    ["Package", f.bytes ? `ZIP · ${f.bytes}` : "ZIP"],
  ],
  empty: { title: "Fonts are on their way", text: "Our first typefaces are being drawn. Check back soon." },
};

function Fonts(props) {
  return <StockLibrary config={config} {...props} />;
}

export default Fonts;
