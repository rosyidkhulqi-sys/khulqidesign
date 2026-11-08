// AI tools that run in the visitor's browser, so they cost nothing per use:
// no tokens, no GPU server. The models are open (commercial use allowed) and
// served from our CDN; the browser keeps them after the first download.
//
//   Remove background  Silueta, a U²-Net (Apache-2.0), 44 MB
//   Upscale 2x / 4x    Real-ESRGAN general x4v3, the compact model
//                      (BSD-3-Clause), 4.9 MB
//
// onnxruntime-web runs them in a worker (proxy mode), so the page stays
// responsive while a model works.
import { PUBLIC_URL } from "./r2";

const CACHE = "kd-models-v1";

export const MODELS = {
  cutout: { url: `${PUBLIC_URL}/models/silueta.onnx`, mb: 44 },
  upscale: { url: `${PUBLIC_URL}/models/realesr-general-x4v3.onnx`, mb: 5 },
};

let ortPromise;
function loadOrt() {
  ortPromise ??= import("onnxruntime-web").then((ort) => {
    // the engine's .wasm file ships with the site (Vite bundles it)
    ort.env.wasm.proxy = true;
    return ort;
  });
  return ortPromise;
}

// the model bytes, from the browser's cache when we have them;
// onProgress(0..1) while downloading
async function modelBytes(url, onProgress) {
  let cache = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) {
      onProgress?.(1);
      return new Uint8Array(await hit.arrayBuffer());
    }
  } catch {
    /* no Cache Storage (private window): download every time */
  }
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("The AI model couldn't be downloaded. Check your internet connection and try again.");
  }
  if (!res.ok) throw new Error(`The AI model couldn't be downloaded (error ${res.status}). Please try again later.`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total) onProgress?.(got / total);
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  try {
    await cache?.put(url, new Response(bytes, { headers: { "Content-Type": "application/octet-stream" } }));
  } catch {
    /* cache full or blocked: fine, it just downloads again next time */
  }
  return bytes;
}

const sessions = {};
async function session(name, onProgress) {
  if (!sessions[name]) {
    sessions[name] = (async () => {
      const ort = await loadOrt();
      const bytes = await modelBytes(MODELS[name].url, onProgress);
      return ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
    })();
    // a failed load can be retried
    sessions[name].catch(() => delete sessions[name]);
  }
  return sessions[name];
}

const canvasOf = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const toBlob = (canvas, type = "image/png", quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The browser couldn't save the image"))), type, quality)
  );

// big photos are scaled down first, so the browser doesn't run out of memory
async function bitmapOf(file, maxSide) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) return bitmap;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const c = canvasOf(w, h);
  c.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return createImageBitmap(c);
}

// ------------------------------------------------------- remove background

const SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

// onStep(label, 0..1). Resolves a PNG with a transparent background.
export async function removeBackground(file, onStep) {
  onStep?.("Loading the AI model", 0);
  const s = await session("cutout", (p) => onStep?.("Loading the AI model", p));
  const ort = await loadOrt();
  onStep?.("Finding the subject", 0);

  const bitmap = await bitmapOf(file, 4096);
  const { width: w, height: h } = bitmap;

  // the model sees a 320 x 320 copy, normalized as it was trained
  const small = canvasOf(SIZE, SIZE).getContext("2d", { willReadFrequently: true });
  small.drawImage(bitmap, 0, 0, SIZE, SIZE);
  const px = small.getImageData(0, 0, SIZE, SIZE).data;
  const input = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 3; c++) input[c * SIZE * SIZE + i] = (px[i * 4 + c] / 255 - MEAN[c]) / STD[c];
  }
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
  const mask = out[s.outputNames[0]].data;

  // stretch the mask to 0..1, then to full size
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of mask) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const maskCanvas = canvasOf(SIZE, SIZE);
  const mctx = maskCanvas.getContext("2d");
  const mdata = mctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const a = Math.round(((mask[i] - lo) / (hi - lo || 1)) * 255);
    mdata.data[i * 4 + 3] = a;
  }
  mctx.putImageData(mdata, 0, 0);

  const full = canvasOf(w, h);
  const ctx = full.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  // keep the photo only where the mask is
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(maskCanvas, 0, 0, w, h);
  bitmap.close();
  onStep?.("Done", 1);
  return toBlob(full);
}

// ---------------------------------------------------------------- upscale

const TILE = 128;
const OVERLAP = 8;
const MODEL_SCALE = 4;
export const UPSCALE_MAX_SIDE = 1024;

// Real-ESRGAN works on 128 px tiles that overlap a little, so no seams show.
// scale 2 or 4; onStep(label, 0..1). Resolves a PNG.
export async function upscale(file, onStep, scale = 2) {
  onStep?.("Loading the AI model", 0);
  const s = await session("upscale", (p) => onStep?.("Loading the AI model", p));
  const ort = await loadOrt();

  const bitmap = await bitmapOf(file, UPSCALE_MAX_SIDE);
  const { width: w, height: h } = bitmap;
  // pad small images up to one tile by repeating the edge
  const pw = Math.max(w, TILE);
  const ph = Math.max(h, TILE);
  const src = canvasOf(pw, ph).getContext("2d", { willReadFrequently: true });
  src.drawImage(bitmap, 0, 0);
  if (pw > w) src.drawImage(src.canvas, w - 1, 0, 1, h, w, 0, pw - w, h);
  if (ph > h) src.drawImage(src.canvas, 0, h - 1, pw, 1, 0, h, pw, ph - h);
  const pixels = src.getImageData(0, 0, pw, ph).data;
  bitmap.close();

  const S = MODEL_SCALE;
  const big = canvasOf(w * S, h * S);
  const bctx = big.getContext("2d");
  const step = TILE - OVERLAP * 2;
  const starts = (len) => {
    const list = [];
    for (let p = 0; p < len - TILE; p += step) list.push(p);
    list.push(len - TILE);
    return [...new Set(list)];
  };
  const xs = starts(pw);
  const ys = starts(ph);
  const total = xs.length * ys.length;
  let done = 0;

  for (const y of ys) {
    for (const x of xs) {
      // a fresh buffer per tile: the worker takes ownership of the last one
      const input = new Float32Array(3 * TILE * TILE);
      for (let ty = 0; ty < TILE; ty++) {
        for (let tx = 0; tx < TILE; tx++) {
          const si = ((y + ty) * pw + (x + tx)) * 4;
          const di = ty * TILE + tx;
          input[di] = pixels[si] / 255;
          input[TILE * TILE + di] = pixels[si + 1] / 255;
          input[2 * TILE * TILE + di] = pixels[si + 2] / 255;
        }
      }
      const res = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, TILE, TILE]) });
      const rec = res[s.outputNames[0]].data;
      const TS = TILE * S;
      const tile = new ImageData(TS, TS);
      for (let i = 0; i < TS * TS; i++) {
        tile.data[i * 4] = Math.max(0, Math.min(255, rec[i] * 255));
        tile.data[i * 4 + 1] = Math.max(0, Math.min(255, rec[TS * TS + i] * 255));
        tile.data[i * 4 + 2] = Math.max(0, Math.min(255, rec[2 * TS * TS + i] * 255));
        tile.data[i * 4 + 3] = 255;
      }
      // keep the middle of each tile; the image edges keep their border
      const cx = x === 0 ? 0 : OVERLAP;
      const cy = y === 0 ? 0 : OVERLAP;
      const cw = (x + TILE >= pw ? TILE : TILE - OVERLAP) - cx;
      const ch = (y + TILE >= ph ? TILE : TILE - OVERLAP) - cy;
      bctx.putImageData(tile, x * S, y * S, cx * S, cy * S, cw * S, ch * S);
      done++;
      onStep?.("Upscaling", done / total);
    }
  }

  if (scale === MODEL_SCALE) {
    onStep?.("Done", 1);
    return toBlob(big);
  }
  // 2x: the 4x result scaled down smoothly is sharper than a 2x model
  const out = canvasOf(w * scale, h * scale);
  const octx = out.getContext("2d");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(big, 0, 0, out.width, out.height);
  onStep?.("Done", 1);
  return toBlob(out);
}
