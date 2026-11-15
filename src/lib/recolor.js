// Recolor a picture in the browser: find its main colors, then move every
// pixel of a chosen color to a new one. Each pixel shifts by the change of
// the color it belongs to (so shading, texture and soft edges survive), and
// a pixel between two colors takes a share of both changes. No model, no
// server, no tokens.

const canvasOf = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export const hexOf = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
export const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// a canvas no longer than maxSide, for previews and for reading colors
export async function scaledCanvas(file, maxSide) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const c = canvasOf(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return c;
}

// The picture's main colors, most used first: [{ rgb, share }]. k-means on a
// small copy, started the same way every time, so the same picture always
// gives the same palette (a kept edit can be put back after logging in).
export function paletteOf(canvas, k = 8) {
  const small = canvasOf(Math.min(160, canvas.width), Math.max(1, Math.round((Math.min(160, canvas.width) * canvas.height) / canvas.width)));
  const ctx = small.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  const { data } = ctx.getImageData(0, 0, small.width, small.height);
  const px = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) px.push([data[i], data[i + 1], data[i + 2]]);
  if (!px.length) return [];

  // start: the most common coarse color, then each next the farthest away
  const buckets = new Map();
  for (const p of px) {
    const key = (p[0] >> 4) * 256 + (p[1] >> 4) * 16 + (p[2] >> 4);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const top = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const centers = [[((top >> 8) << 4) + 8, (((top >> 4) & 15) << 4) + 8, ((top & 15) << 4) + 8]];
  while (centers.length < k) {
    let far = null;
    let best = -1;
    for (let i = 0; i < px.length; i += 3) {
      const d = Math.min(...centers.map((c) => dist2(px[i], c)));
      if (d > best) {
        best = d;
        far = px[i];
      }
    }
    if (!far || best < 400) break; // nothing left that's really different
    centers.push([...far]);
  }

  let counts = [];
  for (let round = 0; round < 10; round++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts = centers.map(() => 0);
    for (const p of px) {
      let n = 0;
      let nd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist2(p, centers[c]);
        if (d < nd) {
          nd = d;
          n = c;
        }
      }
      sums[n][0] += p[0];
      sums[n][1] += p[1];
      sums[n][2] += p[2];
      counts[n]++;
    }
    for (let c = 0; c < centers.length; c++) {
      if (counts[c]) centers[c] = sums[c].map((v) => v / counts[c]);
    }
  }

  return centers
    .map((rgb, i) => ({ rgb: rgb.map(Math.round), share: counts[i] / px.length }))
    .filter((c) => c.share >= 0.01)
    .sort((a, b) => b.share - a.share);
}

// Draws `source` into a new canvas with colors moved: changes[i] is the new
// [r, g, b] for palette[i], or null to keep it. Works in strips, so a big
// picture doesn't freeze the page; onProgress(0..1).
export async function recolorCanvas(source, palette, changes, onProgress) {
  const w = source.width;
  const h = source.height;
  const out = canvasOf(w, h);
  const ctx = out.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const from = palette.map((c) => c.rgb);
  const delta = palette.map((c, i) => (changes[i] ? changes[i].map((v, j) => v - c.rgb[j]) : null));
  if (delta.every((d) => !d)) return out;

  const strip = 96;
  for (let y = 0; y < h; y += strip) {
    const rows = Math.min(strip, h - y);
    const img = ctx.getImageData(0, y, w, rows);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const p = [d[i], d[i + 1], d[i + 2]];
      // the two nearest palette colors, and how much each one owns this pixel
      let a = 0;
      let b = -1;
      let da = Infinity;
      let db = Infinity;
      for (let c = 0; c < from.length; c++) {
        const dc = dist2(p, from[c]);
        if (dc < da) {
          b = a;
          db = da;
          a = c;
          da = dc;
        } else if (dc < db) {
          b = c;
          db = dc;
        }
      }
      // squared distances: a pixel clearly of one color barely feels the other
      const wa = b < 0 ? 1 : db / (da + db || 1);
      const wb = 1 - wa;
      for (let j = 0; j < 3; j++) {
        const shift = (delta[a] ? delta[a][j] * wa : 0) + (b >= 0 && delta[b] ? delta[b][j] * wb : 0);
        d[i + j] = Math.max(0, Math.min(255, d[i + j] + shift));
      }
    }
    ctx.putImageData(img, 0, y);
    onProgress?.((y + rows) / h);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return out;
}

export const blobOf = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The picture couldn't be saved."))), "image/png"));
