// Resizing a whole design to a new format (an Instagram post into a story,
// a poster into a slide), page by page.
//
// The layout scales as one block so it keeps its proportions, and sits in the
// middle of the new page (like CSS object-fit: contain). Anything that covers
// the whole page, such as a background photo or a full-page color block,
// scales to cover the new page instead, so no empty edges show. Every page is
// worked on off screen, with real Fabric objects, and comes back as JSON.
import { FabricImage, FabricText, Group, StaticCanvas } from "fabric";

// covers (nearly) the whole page: treated as background, not content
const COVERS = 0.95;

async function cover(src, w, h) {
  const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
  const scale = Math.max(w / img.width, h / img.height);
  img.set({
    cropX: (img.width - w / scale) / 2,
    cropY: (img.height - h / scale) / 2,
    width: w / scale,
    height: h / scale,
    scaleX: scale,
    scaleY: scale,
  });
  return img;
}

// pages: Fabric JSON per page; from/to: { w, h }; keep: extra properties to
// save with each object (locks, shape settings). Resolves the new pages.
export async function resizePages(pages, from, to, keep = []) {
  const contain = Math.min(to.w / from.w, to.h / from.h);
  const fill = Math.max(to.w / from.w, to.h / from.h);
  const offset = (s) => ({ x: (to.w - from.w * s) / 2, y: (to.h - from.h * s) / 2 });

  const out = [];
  for (const page of pages) {
    const c = new StaticCanvas(undefined, { width: from.w, height: from.h, renderOnAddRemove: false });
    try {
      if (page) await c.loadFromJSON(page);
      for (const obj of c.getObjects()) {
        const box = obj.getBoundingRect();
        const background = box.width >= from.w * COVERS && box.height >= from.h * COVERS;
        const s = background ? fill : contain;
        const { x, y } = offset(s);
        obj.set({
          left: obj.left * s + x,
          top: obj.top * s + y,
          scaleX: obj.scaleX * s,
          scaleY: obj.scaleY * s,
        });
        obj.setCoords();
      }
      // a background photo is cropped afresh to fill the new page
      const photo = c.backgroundImage?.getSrc?.();
      if (photo) c.backgroundImage = await cover(photo, to.w, to.h);
      c.setDimensions({ width: to.w, height: to.h });
      out.push(c.toObject(keep));
    } finally {
      c.dispose();
    }
  }
  return out;
}

// ---------------------------------------------------------- AI resize

const isBackground = (box, size) => box.width >= size.w * COVERS && box.height >= size.h * COVERS;
// Textbox and IText are kinds of FabricText
const kindOf = (obj) =>
  obj instanceof FabricText ? "text"
    : obj instanceof FabricImage ? "image"
      : obj instanceof Group ? "group" : "shape";

// What the AI is told about each page: every element but the backgrounds,
// by its place in the page's list, with its box in the old format.
export async function describePages(pages, size) {
  const out = [];
  for (const page of pages) {
    const c = new StaticCanvas(undefined, { width: size.w, height: size.h, renderOnAddRemove: false });
    try {
      if (page) await c.loadFromJSON(page);
      const elements = [];
      c.getObjects().forEach((obj, id) => {
        if (!obj.visible) return;
        const box = obj.getBoundingRect();
        if (isBackground(box, size)) return;
        const kind = kindOf(obj);
        elements.push({
          id,
          kind,
          x: box.left,
          y: box.top,
          w: box.width,
          h: box.height,
          angle: obj.angle || 0,
          ...(kind === "text" ? { text: obj.text, fontSize: obj.fontSize * (obj.scaleY || 1) } : {}),
        });
      });
      out.push({ elements });
    } finally {
      c.dispose();
    }
  }
  return out;
}

// Puts each element where the AI placed it. pages are the plain-resized
// pages (backgrounds already fill them); layout is the AI's answer.
export async function applyLayout(pages, size, layout, keep = []) {
  const out = [];
  for (const [i, page] of pages.entries()) {
    const c = new StaticCanvas(undefined, { width: size.w, height: size.h, renderOnAddRemove: false });
    try {
      if (page) await c.loadFromJSON(page);
      const objects = c.getObjects();
      for (const place of layout[i]?.elements ?? []) {
        const obj = objects[place.id];
        if (!obj) continue;
        if (kindOf(obj) === "text" && place.fontSize) {
          // text gets a real font size and box, not a stretched picture of itself
          obj.set({ scaleX: 1, scaleY: 1, fontSize: place.fontSize, width: place.w });
          obj.initDimensions?.();
        } else {
          const box = obj.getBoundingRect();
          const f = place.w / Math.max(1, box.width);
          obj.set({ scaleX: obj.scaleX * f, scaleY: obj.scaleY * f });
        }
        obj.setCoords();
        // line the box's top-left corner up with the new place
        const box = obj.getBoundingRect();
        obj.set({ left: obj.left + place.x - box.left, top: obj.top + place.y - box.top });
        obj.setCoords();
      }
      out.push(c.toObject(keep));
    } finally {
      c.dispose();
    }
  }
  return out;
}
