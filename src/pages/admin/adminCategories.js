// The categories each asset type is filed under on /admin. Logos use
// industries instead (data/logosData.js).
import { TEMPLATE_CATEGORIES } from "../../data/templateCategories";
import { VECTOR_CATEGORIES } from "./vectorUpload";
import { ICON_CATEGORIES } from "./iconPublish";
import { FOOTAGE_CATEGORIES } from "./footagePublish";

export const CATEGORIES = {
  vector: VECTOR_CATEGORIES,
  icon: ICON_CATEGORIES,
  footage: FOOTAGE_CATEGORIES,
  template: TEMPLATE_CATEGORIES,
};
