// Photos: the owner's own photographs, sold full size (the JPG or PNG
// original; a transparent PNG says so).
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
    label: p.format,
    detail: `${p.format === "PNG" ? "Transparent, full size" : "Full size"} · ${px(p.artboard)} px`,
    size: p.bytes,
    pending: true,
    format: p.format,
    ext: p.format.toLowerCase(),
  }],
  specs: (p) => [
    ["Format", p.format === "PNG" ? "PNG (transparent)" : "JPG"],
    ["Size", `${px(p.artboard)} px`],
    ["Release", p.editorial ? "None (editorial use only)" : "Not required"],
  ],
  empty: { title: "Photos are on their way", text: "Our first photographs are being added. Check back soon." },
};

function Photos(props) {
  return <StockLibrary config={config} {...props} />;
}

export default Photos;
