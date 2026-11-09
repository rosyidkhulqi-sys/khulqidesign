// Building blocks for the Create editor. Icons, vectors and footage come from
// the same data as the library pages (src/data/), see CreateElements.jsx.

export const artboardPresets = [
  { label: "Instagram Post", ratio: "1:1", w: 1080, h: 1080 },
  { label: "Instagram Portrait", ratio: "4:5", w: 1080, h: 1350 },
  { label: "Story / Reels", ratio: "9:16", w: 1080, h: 1920 },
  { label: "YouTube Thumbnail", ratio: "16:9", w: 1280, h: 720 },
  { label: "Presentation", ratio: "16:9", w: 1920, h: 1080 },
  { label: "A4 Portrait", ratio: "A4", w: 1240, h: 1754 },
  { label: "Business Card", ratio: "7:4", w: 1050, h: 600 },
];

export const shapes = [
  { id: "rect", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
  { id: "triangle", label: "Triangle" },
  { id: "line", label: "Line" },
];

export const textPresets = [
  { id: "heading", label: "Add a heading", size: 96, weight: 700 },
  { id: "subheading", label: "Add a subheading", size: 56, weight: 500 },
  { id: "body", label: "Add body text", size: 36, weight: 400 },
];

export const svgDataUrl = (markup) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
