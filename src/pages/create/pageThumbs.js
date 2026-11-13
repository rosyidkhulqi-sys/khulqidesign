import { StaticCanvas } from "fabric";

// Small pictures of the pages for the strip under the canvas. Each page is
// drawn on its own off-screen canvas, and a page that hasn't changed keeps
// its picture, so moving between pages doesn't redraw the whole design.

const HEIGHT = 128; // twice the shown height, sharp on retina screens
const cache = new Map();

async function draw(page, board) {
  const s = HEIGHT / board.h;
  const c = new StaticCanvas(undefined, {
    width: Math.max(1, Math.round(board.w * s)),
    height: HEIGHT,
    renderOnAddRemove: false,
  });
  try {
    await c.loadFromJSON(page);
    c.setZoom(s);
    c.renderAll();
    return c.toDataURL({ format: "jpeg", quality: 0.75 });
  } catch {
    // a picture from another site without CORS can't be read back
    return null;
  } finally {
    c.dispose();
  }
}

export async function pageThumbs(pages, board) {
  const keys = pages.map((page) => `${board.w}x${board.h}:${JSON.stringify(page)}`);
  const out = [];
  for (const [i, key] of keys.entries()) {
    if (!cache.has(key)) cache.set(key, await draw(pages[i], board));
    out.push(cache.get(key));
  }
  // keep only what the design uses now
  for (const key of cache.keys()) if (!keys.includes(key)) cache.delete(key);
  return out;
}
