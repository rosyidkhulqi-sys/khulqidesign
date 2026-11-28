// A page of the design as a picture, for a mockup's "Use page": drawn
// off screen at up to maxSide pixels on its longer side, PNG so a page
// without its background stays see-through.
import { StaticCanvas } from "fabric";

// background false leaves the page's background color and picture out, so
// only what's on it is drawn (on clear), and trims the empty space around
// it, so a logo in the middle of a page fills the mockup's area
export async function pageImage(page, board, maxSide = 2500, { background = true } = {}) {
  const s = maxSide / Math.max(board.w, board.h);
  const c = new StaticCanvas(undefined, {
    width: Math.max(1, Math.round(board.w * s)),
    height: Math.max(1, Math.round(board.h * s)),
    renderOnAddRemove: false,
  });
  try {
    await c.loadFromJSON(page);
    if (!background) {
      c.backgroundColor = null;
      c.backgroundImage = null;
    }
    c.setZoom(s);
    c.renderAll();
    return background ? c.toDataURL({ format: "png" }) : trimmed(c.getElement());
  } finally {
    c.dispose();
  }
}

// a canvas cut to what's drawn on it, with a thin margin; PNG data URL
function trimmed(canvas) {
  const { width: w, height: h } = canvas;
  const px = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0) return canvas.toDataURL("image/png");
  const m = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - m);
  y0 = Math.max(0, y0 - m);
  x1 = Math.min(w - 1, x1 + m);
  y1 = Math.min(h - 1, y1 + m);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}
