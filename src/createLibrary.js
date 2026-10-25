// Building blocks for the Create editor. Icons/vectors/footage are sample
// entries for now; later they come from the same asset API as the library pages.

export const artboardPresets = [
  { label: "Instagram Post", ratio: "1:1", w: 1080, h: 1080 },
  { label: "Instagram Portrait", ratio: "4:5", w: 1080, h: 1350 },
  { label: "Story / Reels", ratio: "9:16", w: 1080, h: 1920 },
  { label: "YouTube Thumbnail", ratio: "16:9", w: 1280, h: 720 },
  { label: "Presentation", ratio: "16:9", w: 1920, h: 1080 },
  { label: "A4 Portrait", ratio: "A4", w: 1240, h: 1754 },
  { label: "Business Card", ratio: "7:4", w: 1050, h: 600 },
];

export const fonts = [
  "Space Grotesk",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Impact",
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

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;

export const libraryIcons = [
  { id: "heart", name: "Heart", svg: svg('<path fill="#e7212e" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/>') },
  { id: "star", name: "Star", svg: svg('<path fill="#f5b700" d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>') },
  { id: "check", name: "Check", svg: svg('<circle cx="12" cy="12" r="10" fill="#1f6f5c"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>') },
  { id: "arrow", name: "Arrow", svg: svg('<path fill="#1d1d1d" d="M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z"/>') },
  { id: "home", name: "Home", svg: svg('<path fill="#1b2a4a" d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/>') },
  { id: "leaf", name: "Leaf", svg: svg('<path fill="#2f9e44" d="M20 4C10 4 4 9 4 16c0 1.4.3 2.7.8 4 1-3.5 3.6-6.7 7.2-8.5-2.6 2-4.7 4.8-5.6 8.3C7.8 20.6 9.3 21 11 21c6 0 9-6 9-17z"/>') },
  { id: "bell", name: "Bell", svg: svg('<path fill="#d6336c" d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6v-5a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/>') },
  { id: "pin", name: "Location", svg: svg('<path fill="#e7212e" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#ffffff"/>') },
];

export const libraryVectors = [
  { id: "v1", name: "Abstract background", src: "/preview2.jpg" },
  { id: "v2", name: "Illustration", src: "/preview3.jpg" },
  { id: "v3", name: "Landscape", src: "/preview4.jpg" },
  { id: "v4", name: "Pattern", src: "/preview1.jpg" },
];

export const libraryFootage = [
  { id: "f1", name: "Aerial beach", poster: "/preview4.jpg" },
  { id: "f2", name: "Neon loop", poster: "/preview2.jpg" },
  { id: "f3", name: "Mountains", poster: "/preview3.jpg" },
];

export const svgDataUrl = (markup) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
