// Adjust: a photo's light and color, as a light Photoshop. The slider values
// live on the picture as kdAdjust (saved with the design); Fabric's filters
// are built from them and run in the browser, so it costs no server.
//
// Brightness, Contrast and Saturation are free. Temperature, Sharpen, Blur
// and the presets are Premium: free to try on the page, and a picture that
// uses them counts as a Premium item when a free account downloads (the
// watermarked draft), as Premium elements do. Taking the Premium items out
// keeps the photo and its free settings and drops only the Premium ones.
import { filters } from "fabric";

// sliders run -100..100 (Sharpen and Blur 0..100); 0 is the original
export const BASIC = [
  ["brightness", "Brightness", -100],
  ["contrast", "Contrast", -100],
  ["saturation", "Saturation", -100],
];
export const PRO = [
  ["temperature", "Temperature", -100],
  ["sharpen", "Sharpen", 0],
  ["blur", "Blur", 0],
];

// one click looks; each sets the sliders it needs (mono: a gray or sepia pass)
export const PRESETS = [
  ["warm", "Warm", { temperature: 45, saturation: 12 }],
  ["cool", "Cool", { temperature: -45, saturation: -5 }],
  ["bw", "B&W", { mono: "gray", contrast: 12 }],
  ["sepia", "Sepia", { mono: "sepia", contrast: -5 }],
  ["fade", "Fade", { contrast: -22, saturation: -25, brightness: 6 }],
  ["vivid", "Vivid", { saturation: 35, contrast: 12 }],
];

const BASIC_KEYS = BASIC.map(([key]) => key);
const PRO_KEYS = PRO.map(([key]) => key);

export const isProAdjust = (a) => Boolean(a) && (PRO_KEYS.some((key) => a[key]) || Boolean(a.preset));

// the free part of a picture's settings
export const basicOnly = (a) =>
  Object.fromEntries(BASIC_KEYS.filter((key) => a?.[key]).map((key) => [key, a[key]]));

// a picture's settings, as Fabric filters in a fixed order
export function adjustFilters(a = {}) {
  const list = [];
  if (a.brightness) list.push(new filters.Brightness({ brightness: (a.brightness / 100) * 0.4 }));
  if (a.contrast) list.push(new filters.Contrast({ contrast: (a.contrast / 100) * 0.5 }));
  if (a.saturation) list.push(new filters.Saturation({ saturation: a.saturation / 100 }));
  if (a.temperature) {
    // warmer: more red, less blue; cooler the other way
    const t = (a.temperature / 100) * 0.22;
    list.push(new filters.ColorMatrix({ matrix: [1 + t, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1 - t, 0, 0, 0, 0, 0, 1, 0] }));
  }
  if (a.mono === "gray") list.push(new filters.Grayscale());
  if (a.mono === "sepia") list.push(new filters.Sepia());
  if (a.sharpen) {
    const s = (a.sharpen / 100) * 0.8;
    list.push(new filters.Convolute({ matrix: [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0] }));
  }
  if (a.blur) list.push(new filters.Blur({ blur: (a.blur / 100) * 0.4 }));
  return list;
}

// sets a picture's settings and redraws it
export function applyAdjust(img, a) {
  const clean = Object.fromEntries(Object.entries(a).filter(([, value]) => value));
  img.kdAdjust = Object.keys(clean).length ? clean : undefined;
  img.filters = adjustFilters(clean);
  img.applyFilters();
  img.set("dirty", true);
}

// the same as saved JSON, for a design whose Premium items are taken out
export const basicFiltersJson = (a) => adjustFilters(basicOnly(a)).map((filter) => filter.toObject());
