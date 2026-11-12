import { Color, Group } from "fabric";

const colorObjectKeys = new WeakMap();
let nextColorObjectKey = 1;
export const colorObjectKey = (object) => {
  if (!object || (typeof object !== "object" && typeof object !== "function")) return "none";
  if (!colorObjectKeys.has(object)) colorObjectKeys.set(object, nextColorObjectKey++);
  return colorObjectKeys.get(object);
};

export const toHex = (c) => `#${new Color(c).toHex().toLowerCase()}`;

// every drawable leaf of an object (groups and selections are flattened)
export const leaves = (obj) =>
  obj instanceof Group ? obj.getObjects().flatMap(leaves) : [obj];

// the object's colors, each with the fills and strokes that use it
export function paletteOf(obj) {
  const found = new Map();
  leaves(obj).forEach((leaf) => {
    ["fill", "stroke"].forEach((prop) => {
      const c = leaf[prop];
      if (typeof c !== "string" || !c || c === "none" || c === "transparent") return;
      const parsed = new Color(c);
      const hex = `#${parsed.toHex().toLowerCase()}`;
      const alpha = parsed.getAlpha();
      const color = alpha < 0.999
        ? `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`
        : hex;
      if (!found.has(color)) found.set(color, []);
      found.get(color).push([leaf, prop]);
    });
  });
  return [...found].map(([color, targets]) => ({ color, targets }));
}
