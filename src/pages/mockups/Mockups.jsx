// Mockups: layered PSD files with smart objects, shown by a JPG preview,
// as on Magnific and Envato.
import StockLibrary from "../stock/StockLibrary";
import { px } from "../stock/px";
import { MOCKUP_CATEGORY_OPTIONS } from "../../data/stockCategories";

const config = {
  type: "mockup",
  page: "mockups",
  title: "Mockups",
  noun: ["mockup", "mockups"],
  kindWords: ["mockup", "mockups", "psd"],
  placeholder: "Search mockups, devices, business cards, packaging...",
  aiExample: "Business card mockup on a concrete desk",
  categories: MOCKUP_CATEGORY_OPTIONS,
  options: (m) => [{
    label: "PSD",
    detail: `Layered, smart objects · ${px(m.artboard)} px`,
    size: m.bytes,
    pending: true,
    format: "PSD",
    ext: "psd",
  }],
  specs: (m) => [
    ["Format", "PSD (Photoshop)"],
    ["Size", `${px(m.artboard)} px`],
    ["Editable", "Smart objects: place your design"],
  ],
  empty: { title: "Mockups are on their way", text: "Our first PSD mockups are being made. Check back soon." },
};

function Mockups(props) {
  return <StockLibrary config={config} {...props} />;
}

export default Mockups;
