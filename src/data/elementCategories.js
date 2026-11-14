// Categories for assets that can be placed directly onto a Create design.
// Icons have their own managed catalog and are surfaced in Elements without
// uploading or storing a second copy here.
export const ELEMENT_CATEGORIES = ["graphics", "infographics", "grids", "shapes", "frames", "photos"];

export const BACKGROUND_CATEGORIES = [
  "abstract", "gradient", "nature", "pattern", "texture", "holiday", "business", "other",
];

export const ELEMENT_CATEGORY_LABELS = {
  graphics: "Graphics",
  infographics: "Infographics",
  grids: "Grids",
  shapes: "Shapes",
  frames: "Frames",
  photos: "Photos",
  icons: "Icons",
};

const ELEMENT_CATEGORY_ALIASES = {
  graphics: [
    "graphics", "graphic", "graphic-resource", "graphic-resources", "illustration",
    "illustrations", "sticker", "stickers", "badge", "badges", "line", "lines", "other",
  ],
  infographics: ["infographic", "infographics", "chart", "charts", "diagram", "diagrams"],
  grids: ["grid", "grids"],
  shapes: ["shape", "shapes"],
  frames: ["frame", "frames"],
  photos: ["photo", "photos", "photography"],
  icons: ["icon", "icons"],
};

const ELEMENT_CATEGORY_BY_ALIAS = new Map(
  Object.entries(ELEMENT_CATEGORY_ALIASES).flatMap(([category, aliases]) =>
    aliases.map((alias) => [alias, category])
  )
);

export function normalizeElementCategory(value) {
  const key = String(value ?? "graphics").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return ELEMENT_CATEGORY_BY_ALIAS.get(key) ?? "graphics";
}

export function elementCategoryStorageValues(category) {
  return ELEMENT_CATEGORY_ALIASES[category] ?? [category];
}

export function elementCategoryLabel(category) {
  return ELEMENT_CATEGORY_LABELS[category] ?? String(category ?? "").replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function backgroundCategoryLabel(category) {
  return String(category ?? "").replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
