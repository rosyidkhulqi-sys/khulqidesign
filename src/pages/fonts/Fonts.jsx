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
  // what's in the ZIP, summed up: its font formats, license and readme
  // (a package of several versions lists the same names many times)
  specs: (f) => {
    const names = [...new Set((f.files?.[0]?.contents ?? []).map((n) => n.split("/").pop()))];
    const ext = (n) => n.split(".").pop().toUpperCase();
    const formats = [...new Set(names.filter((n) => /\.(otf|ttf|woff2?)$/i.test(n)).map(ext))]
      .sort((a, b) => ["OTF", "TTF", "WOFF2", "WOFF"].indexOf(a) - ["OTF", "TTF", "WOFF2", "WOFF"].indexOf(b));
    const licenses = [...new Set(names.filter((n) => /licen[cs]e|eula/i.test(n)).map(ext))];
    const fonts = (f.files?.[0]?.contents ?? []).filter((n) => /\.(otf|ttf|woff2?)$/i.test(n)).length;
    return [
      ["Formats", formats.join(", ") || "OTF, TTF, WOFF2"],
      ...(licenses.length ? [["License", `EULA (${licenses.join(", ")})`]] : []),
      ["Package", `ZIP${fonts ? ` · ${fonts} font files` : ""}${f.bytes ? ` · ${f.bytes}` : ""}`],
    ];
  },
  empty: { title: "Fonts are on their way", text: "Our first typefaces are being drawn. Check back soon." },
};

function Fonts(props) {
  return <StockLibrary config={config} {...props} />;
}

export default Fonts;
