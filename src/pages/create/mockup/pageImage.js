// A page of the design as a picture, for a mockup's "Use page": drawn
// off screen at up to maxSide pixels on its longer side, PNG so a page with
// a see-through background keeps it.
import { StaticCanvas } from "fabric";

export async function pageImage(page, board, maxSide = 2500) {
  const s = maxSide / Math.max(board.w, board.h);
  const c = new StaticCanvas(undefined, {
    width: Math.max(1, Math.round(board.w * s)),
    height: Math.max(1, Math.round(board.h * s)),
    renderOnAddRemove: false,
  });
  try {
    await c.loadFromJSON(page);
    c.setZoom(s);
    c.renderAll();
    return c.toDataURL({ format: "png" });
  } finally {
    c.dispose();
  }
}
