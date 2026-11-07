// Trial footage: real MP4 clips with a poster frame, in public/trial-footage/.
// Only "video background" is in git. Clips marked localOnly are heavy and stay
// on the developer's machine: they show on localhost (npm run dev) and are
// left out of the production build, so the live site has no broken cards.
// Later the backend stores the master file and uses FFmpeg to make the poster,
// smaller renditions and a watermarked preview.
//
// The clip's own metadata (XMP title, description, keywords) is kept for
// search only, extracted with:
//   exiftool -j -Title -Description -Subject public/trial-footage/*.mp4
// The page shows a short title and a few keywords so it stays clean.
import meta from "./trialFootageMeta.json";

const folder = "/trial-footage/";
const url = (file) => folder + encodeURIComponent(file);

const mb = (bytes) => `${Math.round(bytes / 1_000_000)} MB`;

// specs read from each file with exiftool; poster: a frame at 2 s, 1280 px
const trialClips = [
  {
    file: "V 0125-46",
    localOnly: true,
    title: "Blue swirling motion background",
    category: "abstract",
    license: "free",
    size: [3840, 2160],
    fps: 60,
    duration: 10,
    loop: false,
    bytes: 18035354,
  },
  {
    file: "V 0825 16",
    localOnly: true,
    title: "Liquid marble wave loop",
    category: "abstract",
    license: "premium",
    size: [3840, 2160],
    fps: 60,
    duration: 10,
    loop: true,
    bytes: 18836194,
  },
  {
    // no embedded metadata, so its keywords are written here
    file: "video background",
    title: "Perspective grid room",
    category: "abstract",
    license: "free",
    size: [3840, 2160],
    fps: 60,
    duration: 10,
    loop: false,
    bytes: 18639800,
    keywords: ["grid", "perspective", "3d room", "wireframe", "tunnel", "black and white", "technology", "background"],
  },
];

const orientationOf = ([w, h]) => (w === h ? "square" : w > h ? "horizontal" : "vertical");

// import.meta.env.DEV is true on localhost and false in the production build
const available = trialClips.filter((c) => import.meta.env.DEV || !c.localOnly);

export const clips = available.map((c, i) => {
  const info = meta[c.file] ?? { title: c.title, description: "", keywords: c.keywords };
  return {
    id: i + 1,
    code: `KD-FT-${String(300000 + i * 7).padStart(6, "0")}`,
    title: c.title,
    // search only, never shown
    searchText: `${info.title} ${info.description}`.toLowerCase(),
    category: c.category,
    license: c.license,
    image: url(`${c.file}.jpg`),
    file: url(`${c.file}.mp4`),
    size: c.size,
    sizeLabel: mb(c.bytes),
    resolution: c.size[0] >= 3840 ? "4K" : "HD",
    fps: c.fps,
    duration: c.duration,
    orientation: orientationOf(c.size),
    loop: c.loop,
    downloads: (i * 53) % 900,
    // contributors write keywords in mixed case and sometimes repeat one
    keywords: [...new Set(info.keywords.map((k) => k.toLowerCase()))],
  };
});
