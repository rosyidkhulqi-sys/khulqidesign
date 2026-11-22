// Categories for the Photos and Mockups libraries, as Adobe Stock and
// Magnific sort them. Stored as the ids; labels are for people.
export const PHOTO_CATEGORY_OPTIONS = [
  ["backgrounds", "Backgrounds & Textures"],
  ["buildings", "Buildings & Architecture"],
  ["business", "Business"],
  ["food", "Food & Drink"],
  ["holiday", "Holidays"],
  ["landscape", "Landscape"],
  ["lifestyle", "Lifestyle"],
  ["nature", "Nature"],
  ["people", "People"],
  ["plants", "Plants & Flowers"],
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
