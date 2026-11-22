// Photos: the owner's own photographs, sold full size (the JPG original).
// AI photos join later, labeled as AI.
import StockLibrary from "../stock/StockLibrary";
import { px } from "../stock/px";
import { PHOTO_CATEGORY_OPTIONS } from "../../data/stockCategories";

const config = {
  type: "photo",
  page: "photos",
  title: "Photos",
  noun: ["photo", "photos"],
  kindWords: ["photo", "photos", "image", "images"],
  placeholder: "Search photos, backgrounds, food, buildings...",
  aiExample: "Fresh oranges on a white marble table",
  categories: PHOTO_CATEGORY_OPTIONS,
  options: (p) => [{
    label: "JPG",
    detail: `Full size · ${px(p.artboard)} px`,
    size: p.bytes,
    pending: true,
    format: "JPG",
    ext: "jpg",
  }],
  specs: (p) => [
    ["Format", "JPG"],
    ["Size", `${px(p.artboard)} px`],
    ["Release", "Not required"],
  ],
  empty: { title: "Photos are on their way", text: "Our first photographs are being added. Check back soon." },
};

function Photos(props) {
  return <StockLibrary config={config} {...props} />;
}

export default Photos;
