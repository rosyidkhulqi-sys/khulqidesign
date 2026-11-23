// Every asset library, in one list for the Assets menu, the /assets page,
// the phone menu and the footer, as Magnific groups its Stock. type is the
// assets.type its live count comes from; image is a cover (or a glyph when
// a library has no cover yet), images a few pinned covers that take turns
// from visit to visit (they never follow new uploads); badge marks what's new.
export const libraries = [
  { page: "icons", title: "Icons", type: "icon", unit: ["icon", "icons"], image: "/covers/icons.jpg", blurb: "Single icons and sets, recolor in SVG" },
  { page: "vectors", title: "Vectors", type: "vector", unit: ["vector", "vectors"], image: "/covers/vectors.jpg", blurb: "Illustrations, backgrounds, seasonal art" },
  { page: "photos", title: "Photos", type: "photo", unit: ["photo", "photos"], images: ["/covers/menu-photos-1.jpg", "/covers/menu-photos-2.jpg", "/covers/menu-photos-3.jpg", "/covers/menu-photos-4.jpg"], badge: "New", blurb: "Full-size photographs, free and Premium" },
  { page: "logos", title: "Logos", type: "logo", unit: ["logo", "logos"], image: "/covers/logos.jpg", blurb: "Ready-made logos, up to exclusive" },
  { page: "templates", title: "Templates", type: "template", unit: ["template", "templates"], image: "/covers/menu-templates.jpg", blurb: "Posters, posts, decks, edit in Create" },
  { page: "mockups", title: "Mockups", type: "mockup", unit: ["mockup", "mockups"], glyph: "mockup", tint: "#1D4E9E", badge: "New", blurb: "Layered PSD mockups with smart objects" },
  { page: "footage", title: "Footage", type: "footage", unit: ["clip", "clips"], image: "/covers/menu-footage.jpg", play: true, blurb: "4K motion backgrounds and loops" },
];

export const libraryPages = new Set([...libraries.map((l) => l.page), "assets"]);
