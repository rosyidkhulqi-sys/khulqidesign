// Trial logos: ready-made logos, part of Brand identity (in the spirit of
// Logoground and Logoku). The 6250 px JPG originals stay on the developer's
// machine; public/trial-logos/preview/ holds 1500 px copies made with
//   sips -Z 1500 -s formatOptions 82 <file> --out preview/<file>
// Later the backend stores the master files (AI, EPS, SVG, PNG, PDF) and
// makes the previews itself.
//
// Three licenses:
//   free       download now, credit required; draws visitors in
//   premium    non-exclusive: included with the subscription, many buyers
//              may use the same logo
//   exclusive  bought outright at a fixed price, by one buyer only; then it
//              is marked sold and no one else can buy it
// Prices and sold state are placeholders until checkout exists.
//
// The file's own metadata (title, description, keywords) is kept for search
// only, extracted with:
//   exiftool -j -Title -Description -Subject public/trial-logos/*.jpg
import meta from "./trialLogosMeta.json";

const folder = "/trial-logos/preview/";
const url = (file) => folder + encodeURIComponent(`${file}.jpg`);

export const industries = [
  ["food", "Food & drink"],
  ["beauty", "Beauty & salon"],
  ["health", "Health & wellness"],
  ["tech", "Tech & gaming"],
  ["business", "Business"],
  ["travel", "Travel & outdoor"],
  ["nature", "Nature & eco"],
  ["automotive", "Automotive"],
];

export const logoStyles = [
  ["mascot", "Mascot"],
  ["badge", "Vintage badge"],
  ["line", "Line art"],
  ["monogram", "Monogram"],
  ["abstract", "Abstract"],
];

export const industryName = Object.fromEntries(industries);
export const styleName = Object.fromEntries(logoStyles);

// title: the short display name; price in USD, only for exclusive logos
const trialLogos = [
  { file: "M 0526 11", title: "Crowned rooster mascot", industry: "food", style: "mascot", license: "exclusive", price: 249 },
  { file: "M 0526 13", title: "Green fields landscape", industry: "nature", style: "line", license: "free" },
  { file: "M 0526 14", title: "Mountain flight badge", industry: "travel", style: "badge", license: "premium" },
  { file: "M 0526 18", title: "Retro barber shop badge", industry: "beauty", style: "badge", license: "exclusive", price: 199, sold: true },
  { file: "M 0526 20", title: "Classic garage emblem", industry: "automotive", style: "badge", license: "premium" },
  { file: "M 0526 25", title: "Zen koi circle", industry: "health", style: "line", license: "free" },
  { file: "M 0526 26", title: "Dragon letter S", industry: "tech", style: "monogram", license: "exclusive", price: 299 },
  { file: "M 0526 33", title: "Wood-fired pizza oven", industry: "food", style: "mascot", license: "premium" },
  { file: "M 0526 35", title: "Floral beauty portrait", industry: "beauty", style: "line", license: "exclusive", price: 349 },
  { file: "M 0526 44", title: "Twin peaks monogram", industry: "business", style: "monogram", license: "free" },
  { file: "M 0526 48", title: "Hexagon flame tech", industry: "tech", style: "abstract", license: "premium" },
  { file: "M 0526 9", title: "Connected cell circle", industry: "health", style: "abstract", license: "exclusive", price: 199 },
];

export const logos = trialLogos.map((l, i) => {
  const { title: longTitle, description, keywords } = meta[l.file];
  return {
    id: i + 1,
    code: `KD-LG-${String(300000 + i * 17).padStart(6, "0")}`,
    title: l.title,
    // search only, never shown
    searchText: `${longTitle} ${description}`.toLowerCase(),
    industry: l.industry,
    style: l.style,
    license: l.license,
    price: l.price ?? null,
    sold: Boolean(l.sold),
    image: url(l.file),
    downloads: (i * 41) % 300,
    keywords: [...new Set(keywords.map((k) => k.toLowerCase()))],
  };
});
