// Categories for the Photos and Mockups libraries, as Adobe Stock and
// Magnific sort them. Stored as the ids; labels are for people.
export const PHOTO_CATEGORY_OPTIONS = [
  ["animals", "Animals"],
  ["backgrounds", "Backgrounds & Textures"],
  ["buildings", "Buildings & Architecture"],
  ["business", "Business"],
  ["culture-religion", "Culture & Religion"],
  ["food", "Food & Drink"],
  ["fruits-vegetables", "Fruits & Vegetables"],
  ["health", "Health & Medicine"],
  ["heritage", "Historic Sites & Landmarks"],
  ["holiday", "Holidays"],
  // drawn pictures sold as JPG or PNG (no EPS), as Adobe Stock files them
  // under Images, not Vectors
  ["illustration", "Illustrations"],
  ["landscape", "Landscape"],
  ["lifestyle", "Lifestyle"],
  ["nature", "Nature"],
  ["objects", "Objects & Still Life"],
  ["people", "People"],
  ["plants", "Plants & Flowers"],
  ["sky", "Sky & Weather"],
  ["sports", "Sports & Fitness"],
  ["technology", "Technology"],
  ["travel", "Travel"],
  ["other", "Other"],
];

export const MOCKUP_CATEGORY_OPTIONS = [
  ["devices", "Devices & Screens"],
  ["stationery", "Stationery & Branding"],
  ["print", "Posters & Print"],
  ["packaging", "Packaging"],
  ["apparel", "Apparel"],
  ["signage", "Signs & Outdoor"],
  ["social", "Social Media"],
  ["other", "Other"],
];

const labels = Object.fromEntries([...PHOTO_CATEGORY_OPTIONS, ...MOCKUP_CATEGORY_OPTIONS]);
export const stockCategoryLabel = (id) => labels[id] ?? "Other";
