// Trial vectors: real EPS files with a JPG preview, in public/trial-vectors/
// (local only, not in git). Later the backend stores the EPS and makes the
// preview and thumbnails itself.
//
// The JPG's own metadata (IPTC/XMP title, description, keywords, as Adobe
// Stock and Shutterstock read it) is kept for search only, extracted with:
//   exiftool -j -Title -Description -Keywords public/trial-vectors/*.jpg
// The page shows a short title and a few keywords so it stays clean, as
// Magnific does. The backend will read the same fields from each upload.
import meta from "./trialVectorsMeta.json";

const folder = "/trial-vectors/";
const url = (file) => folder + encodeURIComponent(file);

const mb = (bytes) => `${(bytes / 1_000_000).toFixed(1)} MB`;

// title: the short display name. Category is picked on upload, as the files
// don't carry one.
// artboard: the EPS artboard; preview: the JPG export
const trialVectors = [
  {
    file: "M 1026 104",
    title: "Hello November autumn greeting",
    category: "holiday",
    license: "free",
    artboard: [3000, 3000],
    preview: [6250, 6250],
    bytes: { eps: 640690, jpg: 1763186 },
  },
  {
    file: "M 1026 18",
    title: "Boho abstract frame background",
    category: "background",
    license: "free",
    artboard: [3840, 2160],
    preview: [8000, 4500],
    bytes: { eps: 622668, jpg: 1016919 },
  },
  {
    file: "M 1026 74",
    title: "Happy Halloween night banner",
    category: "holiday",
    license: "premium",
    artboard: [3840, 2160],
    preview: [8000, 4500],
    bytes: { eps: 609447, jpg: 1351503 },
  },
  {
    file: "M 1026 80",
    title: "Colorful layered wave background",
    category: "background",
    license: "free",
    artboard: [3840, 2160],
    preview: [8000, 4500],
    bytes: { eps: 553014, jpg: 1266801 },
  },
  {
    file: "M 1026 91",
    title: "Happy Halloween poster",
    category: "holiday",
    license: "premium",
    artboard: [3000, 3000],
    preview: [6250, 6250],
    bytes: { eps: 609978, jpg: 2500410 },
  },
];

const orientationOf = ([w, h]) => (w === h ? "square" : w > h ? "landscape" : "portrait");

export const vectors = trialVectors.map((v, i) => {
  const { title: longTitle, description, keywords } = meta[v.file];
  return {
    id: i + 1,
    code: `KD-VC-${String(200000 + i * 13).padStart(6, "0")}`,
    title: v.title,
    // search only, never shown
    searchText: `${longTitle} ${description}`.toLowerCase(),
    category: v.category,
    license: v.license,
    image: url(`${v.file}.jpg`),
    // download file per format
    sources: {
      EPS: { url: url(`${v.file}.eps`), size: mb(v.bytes.eps) },
      JPG: { url: url(`${v.file}.jpg`), size: mb(v.bytes.jpg) },
    },
    files: ["EPS", "JPG"],
    format: "EPS",
    artboard: v.artboard,
    preview: v.preview,
    orientation: orientationOf(v.artboard),
    downloads: (i * 37) % 500,
    // contributors write keywords in mixed case and sometimes repeat one
    keywords: [...new Set(keywords.map((k) => k.toLowerCase()))],
  };
});
