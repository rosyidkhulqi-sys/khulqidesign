// After Remove background: put the cut-out subject on a new background, in
// the browser. "color" lays it on a plain color; "blur" on its own original
// photo, softly blurred (a portrait-mode look). Nothing is cut again, so it
// costs no daily allowance.
//   cut: the transparent PNG (same size as the original); original: the file

const loadBitmap = (blob) => createImageBitmap(blob);

const canvasOf = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

// a soft blur that works in every browser: shrink the picture a lot, then
// grow it back with smoothing, twice (canvas filters aren't in older Safari)
// strength: 1 is the look; larger is softer (used to fill gaps)
function blurred(bitmap, w, h, strength = 1) {
  const steps = [Math.max(6, Math.round(w / (12 * strength))), Math.max(4, Math.round(w / (28 * strength)))];
  let source = bitmap;
  let sw = bitmap.width;
  let sh = bitmap.height;
  for (const small of steps) {
    const sh2 = Math.max(4, Math.round((small * h) / w));
    const c = canvasOf(small, sh2);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, sw, sh, 0, 0, small, sh2);
    source = c;
    sw = small;
    sh = sh2;
  }
  const out = canvasOf(w, h);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // a little larger than the frame, so the soft edges don't show
  const pad = Math.round(Math.max(w, h) * 0.04);
  ctx.drawImage(source, 0, 0, sw, sh, -pad, -pad, w + pad * 2, h + pad * 2);
  return out;
}

export async function composeBackground(cut, original, { mode, color = "#ffffff" }) {
  if (mode === "transparent") return cut;
  const subject = await loadBitmap(cut);
  const w = subject.width;
  const h = subject.height;
  const canvas = canvasOf(w, h);
  const ctx = canvas.getContext("2d");
  try {
    if (mode === "blur") {
      const photo = await loadBitmap(original);
      try {
        // The scene without the subject (its soft edge too, so no dark halo),
        // blurred: the canvas keeps alpha, so averaging fills the hole with
        // the colors around it. Under it: the scene's own average color, then
        // softer passes, so nothing of the subject shows through.
        const scene = canvasOf(w, h);
        const sctx = scene.getContext("2d");
        sctx.drawImage(photo, 0, 0, w, h);
        sctx.globalCompositeOperation = "destination-out";
        const grow = Math.max(2, Math.round(Math.max(w, h) * 0.006));
        for (const [dx, dy] of [[0, 0], [grow, 0], [-grow, 0], [0, grow], [0, -grow], [grow, grow], [-grow, -grow], [grow, -grow], [-grow, grow]]) {
          sctx.drawImage(subject, dx, dy, w, h);
        }
        const average = canvasOf(1, 1);
        average.getContext("2d").drawImage(scene, 0, 0, 1, 1);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(average, 0, 0, w, h);
        for (const strength of [4, 2.5, 1.6]) ctx.drawImage(blurred(scene, w, h, strength), 0, 0);
        ctx.drawImage(blurred(scene, w, h), 0, 0);
      } finally {
        photo.close();
      }
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(subject, 0, 0, w, h);
  } finally {
    subject.close();
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The new background couldn't be made. Try again.");
  return blob;
}
