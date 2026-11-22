// The categories each asset type is filed under on /admin. Logos use
// industries instead (data/logosData.js).
import { TEMPLATE_CATEGORIES } from "../../data/templateCategories";
import { VECTOR_CATEGORIES } from "../../data/vectorCategories";
import { ICON_CATEGORIES } from "./iconPublish";
import { FOOTAGE_CATEGORIES } from "./footagePublish";
import { MOCKUP_CATEGORY_OPTIONS, PHOTO_CATEGORY_OPTIONS } from "../../data/stockCategories";

export const CATEGORIES = {
  vector: VECTOR_CATEGORIES,
  icon: ICON_CATEGORIES,
  footage: FOOTAGE_CATEGORIES,
  template: TEMPLATE_CATEGORIES,
  photo: PHOTO_CATEGORY_OPTIONS.map(([id]) => id),
  mockup: MOCKUP_CATEGORY_OPTIONS.map(([id]) => id),
};
