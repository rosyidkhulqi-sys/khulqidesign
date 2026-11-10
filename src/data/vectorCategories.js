// A practical vector taxonomy combining Adobe Stock and Shutterstock themes.
// Legacy categories remain selectable so existing assets stay editable.
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
  ["texture", "Graphic Resources · Textures"],
  ["transportation", "Transportation"],
  ["travel", "Travel"],
  ["abstract", "Graphic Resources · Abstract"],
  ["background", "Graphic Resources · Backgrounds"],
  ["other", "Other"],
];

export const VECTOR_CATEGORIES = VECTOR_CATEGORY_OPTIONS.map(([id]) => id);
export const VECTOR_CATEGORY_LABELS = Object.fromEntries(VECTOR_CATEGORY_OPTIONS);

export function vectorCategoryLabel(id) {
  return VECTOR_CATEGORY_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}
