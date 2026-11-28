// A draft download for an account without Premium, as Canva offers one: the
// design as it is, with the watermark drawn over every Premium item's area
// (a photo, an element, a filled frame, a whole Premium template). Free items
// stay clean. Premium photos already carry it; elements and templates don't,
// so it's drawn here for all of them alike.
import { isProAdjust } from "./photoAdjust";

const WORD = "KHULQIDESIGN";

// a Premium item, or a photo with Premium Adjust settings (a preset, Blur...)
const hasPremium = (o) => Boolean(o.kdPremium) || isProAdjust(o.kdAdjust) || (o.getObjects?.() ?? []).some(hasPremium);

// each Premium item's box on the page, in page pixels
export function premiumAreas(canvas) {
  return canvas.getObjects().filter(hasPremium).map((o) => o.getBoundingRect());
}

// the watermark over each area of a picture drawn at `scale` page pixels
function stamp(ctx, areas, scale) {
  for (const a of areas) {
    const x = a.left * scale;
    const y = a.top * scale;
    const w = a.width * scale;
    const h = a.height * scale;
    if (w < 2 || h < 2) continue;
    const size = Math.max(12 * scale, Math.min(w, h) / 9);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    // a light veil, so the item reads as a preview
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x, y, w, h);
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(1, size / 14);
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    const step = { x: ctx.measureText(WORD).width + size * 1.6, y: size * 2.6 };
    const reach = Math.hypot(w, h) / 2 + step.x;
    for (let row = -reach, i = 0; row <= reach; row += step.y, i++) {
      // every other row shifted, as a woven pattern
      for (let col = -reach + (i % 2 ? step.x / 2 : 0); col <= reach; col += step.x) {
        ctx.strokeText(WORD, col, row);
        ctx.fillText(WORD, col, row);
      }
    }
    ctx.restore();
  }
}

// a page picture (data URL) with the watermark over the areas, as a JPEG
export async function stampDataUrl(url, areas, scale) {
  if (!areas.length) return url;
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  stamp(ctx, areas, scale);
  return canvas.toDataURL("image/jpeg", 0.92);
}
