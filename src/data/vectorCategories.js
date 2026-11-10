// A practical vector taxonomy combining Adobe Stock and Shutterstock themes.
export const VECTOR_CATEGORY_OPTIONS = [
  ["animals", "Animals & Wildlife"],
  ["beauty-fashion", "Beauty & Fashion"],
  ["buildings-landmarks", "Buildings & Architecture"],
  ["business", "Business & Finance"],
  ["celebrities", "Celebrities"],
  ["culture-religion", "Culture & Religion"],
  ["education", "Education"],
  ["food", "Food & Drink"],
  ["graphic-resources", "Graphic Resources"],
  ["background-texture", "Background/Texture"],
  ["healthcare-medical", "Healthcare & Medical"],
  ["hobbies-leisure", "Hobbies & Leisure"],
  ["holiday", "Holidays"],
  ["industry", "Industry"],
  ["landscape", "Landscape"],
  ["lifestyle", "Lifestyle"],
  ["nature", "Nature & Environment"],
  ["people", "People"],
  ["plants-flowers", "Plants & Flowers"],
  ["science", "Science"],
  ["signs-symbols", "Signs & Symbols"],
  ["social-issues", "Social Issues"],
  ["sports-recreation", "Sports & Recreation"],
  ["states-of-mind", "States of Mind"],
  ["technology", "Technology"],
  ["transportation", "Transportation"],
  ["travel", "Travel"],
  ["other", "Other"],
];

export const VECTOR_CATEGORIES = VECTOR_CATEGORY_OPTIONS.map(([id]) => id);
export const VECTOR_CATEGORY_LABELS = Object.fromEntries(VECTOR_CATEGORY_OPTIONS);

const LEGACY_VECTOR_CATEGORIES = {
  abstract: "graphic-resources",
  background: "background-texture",
  texture: "background-texture",
};

const VECTOR_CATEGORY_STORAGE_VALUES = {
  "graphic-resources": ["graphic-resources", "abstract"],
  "background-texture": ["background-texture", "background", "texture"],
};

export function normalizeVectorCategory(id) {
  return LEGACY_VECTOR_CATEGORIES[id] ?? id ?? "other";
}

export function vectorCategoryStorageValues(id) {
  return VECTOR_CATEGORY_STORAGE_VALUES[id] ?? [id];
}

export function vectorCategoryLabel(id) {
  const category = normalizeVectorCategory(id);
  return VECTOR_CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}
