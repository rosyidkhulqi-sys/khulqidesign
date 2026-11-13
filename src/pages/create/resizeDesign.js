// Resizing a whole design to a new format (an Instagram post into a story,
// a poster into a slide), page by page.
//
// The layout scales as one block so it keeps its proportions, and sits in the
// middle of the new page (like CSS object-fit: contain). Anything that covers
// the whole page, such as a background photo or a full-page color block,
// scales to cover the new page instead, so no empty edges show. Every page is
// worked on off screen, with real Fabric objects, and comes back as JSON.
import { FabricImage, StaticCanvas } from "fabric";

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
