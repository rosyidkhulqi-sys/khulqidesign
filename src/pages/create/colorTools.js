import { Color, Group } from "fabric";

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
      const color = toHex(c);
      if (!found.has(color)) found.set(color, []);
      found.get(color).push([leaf, prop]);
    });
  });
  return [...found].map(([color, targets]) => ({ color, targets }));
}
