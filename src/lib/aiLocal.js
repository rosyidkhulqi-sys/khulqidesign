// AI tools that run in the visitor's browser, so they cost nothing per use:
// no tokens, no GPU server. The models are open (commercial use allowed) and
// served from our CDN; the browser keeps them after the first download.
//
//   Remove background  Silueta, a U²-Net (Apache-2.0), 44 MB
//   Upscale 2x / 4x    Real-ESRGAN general x4v3, the compact model
//                      (BSD-3-Clause), 4.9 MB
//
// The models run in our own worker (aiWorker.js), so the page stays
// responsive while a model works. (onnxruntime's built-in proxy worker can't
// be used: in the production build it loads the whole site into the worker.)
import { PUBLIC_URL } from "./r2";

const CACHE = "kd-models-v1";

export const MODELS = {
  cutout: { url: `${PUBLIC_URL}/models/silueta.onnx`, mb: 44 },
  upscale: { url: `${PUBLIC_URL}/models/realesr-general-x4v3.onnx`, mb: 5 },
};

// one worker for every model; each call gets an id so answers find their way back
let worker = null;
let nextId = 0;
const waiting = new Map();
const sessions = {};
const MODEL_NOT_LOADED = "The AI model hasn't been loaded.";

function call(message, transfer = []) {
  if (!worker) {
    worker = new Worker(new URL("./aiWorker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const p = waiting.get(data.id);
      waiting.delete(data.id);
      if (data.error) {
        if (data.error === MODEL_NOT_LOADED && p?.name) delete sessions[p.name];
        p?.reject(new Error(data.error));
      }
      else p?.resolve(data);
    };
    // the worker itself couldn't start: fail every call and start fresh next time
    worker.onerror = () => {
      for (const p of waiting.values()) p.reject(new Error("The AI tool couldn't start in this browser. Try reloading the page."));
      waiting.clear();
      worker.terminate();
      worker = null;
      for (const name of Object.keys(sessions)) delete sessions[name];
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject, name: message.name });
    worker.postMessage({ ...message, id }, transfer);
  });
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

// loads a model into the worker once; resolves run(input, dims) -> { data, dims }
async function session(name, onProgress) {
  if (!sessions[name]) {
    sessions[name] = (async () => {
      const bytes = await modelBytes(MODELS[name].url, onProgress);
      await call({ type: "load", name, bytes }, [bytes.buffer]);
      // the input buffer moves to the worker, so callers make a new one each run
      return async (input, dims, retried = false) => {
        // Keep a small copy so a newly restarted worker can load the model and
        // retry the current tile without making the user restart the operation.
        const retryInput = input.slice();
        try {
          return await call({ type: "run", name, input, dims }, [input.buffer]);
        } catch (error) {
          if (retried || error.message !== MODEL_NOT_LOADED) throw error;
          delete sessions[name];
          const retry = await session(name, onProgress);
          return retry(retryInput, dims, true);
        }
      };
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

// Fill every pixel with the closest confident background color from the
// model-sized image. The map is only 320 × 320, so this stays inexpensive.
function nearestBackgroundCanvas(pixels, alpha, size) {
  const count = size * size;
  const nearest = new Int32Array(count).fill(-1);
  const queue = new Uint32Array(count);
  let tail = 0;

  for (let i = 0; i < count; i++) {
    if (alpha[i] <= 8) {
      nearest[i] = i;
      queue[tail++] = i;
    }
  }
  if (!tail) return null;

  for (let head = 0; head < tail; head++) {
    const i = queue[head];
    const x = i % size;
    const y = (i / size) | 0;
    const colorAt = nearest[i];
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= size) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= size) continue;
        const next = ny * size + nx;
        if (nearest[next] !== -1) continue;
        nearest[next] = colorAt;
        queue[tail++] = next;
      }
    }
  }

  const canvas = canvasOf(size, size);
  const context = canvas.getContext("2d");
  const data = context.createImageData(size, size);
  for (let i = 0; i < count; i++) {
    const source = nearest[i] * 4;
    const target = i * 4;
    data.data[target] = pixels[source];
    data.data[target + 1] = pixels[source + 1];
    data.data[target + 2] = pixels[source + 2];
    data.data[target + 3] = 255;
  }
  context.putImageData(data, 0, 0);
  return canvas;
}

const clampByte = (value) => Math.max(0, Math.min(255, value));

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

// onStep(label, 0..1). Resolves a PNG with a transparent background. When
// cropToSubject is set, also returns the visible subject bounds for the editor.
export async function removeBackground(file, onStep, { cropToSubject = false } = {}) {
  onStep?.("Loading the AI model", 0);
  const run = await session("cutout", (p) => onStep?.("Loading the AI model", p));
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
  const { data: mask } = await run(input, [1, 3, SIZE, SIZE]);

  // Normalize the model mask and keep the 320px alpha values for estimating
  // background colors along the subject edge.
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of mask) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const alpha = new Uint8ClampedArray(SIZE * SIZE);
  const maskCanvas = canvasOf(SIZE, SIZE);
  const mctx = maskCanvas.getContext("2d");
  const mdata = mctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const a = Math.round(Math.max(0, Math.min(1, (mask[i] - lo) / (hi - lo || 1))) * 255);
    alpha[i] = a;
    mdata.data[i * 4 + 3] = a;
  }
  mctx.putImageData(mdata, 0, 0);

  const background = nearestBackgroundCanvas(px, alpha, SIZE);
  const full = canvasOf(w, h);
  const output = full.getContext("2d", { willReadFrequently: true });
  const stripHeight = 64;
  const sourceStrip = canvasOf(w, stripHeight);
  const sourceStripContext = sourceStrip.getContext("2d", { willReadFrequently: true });
  const maskStrip = canvasOf(w, stripHeight);
  const maskStripContext = maskStrip.getContext("2d", { willReadFrequently: true });
  maskStripContext.imageSmoothingEnabled = true;
  maskStripContext.imageSmoothingQuality = "high";
  const backgroundStrip = background ? canvasOf(w, stripHeight) : null;
  const backgroundStripContext = backgroundStrip?.getContext("2d", { willReadFrequently: true });
  if (backgroundStripContext) {
    backgroundStripContext.imageSmoothingEnabled = true;
    backgroundStripContext.imageSmoothingQuality = "high";
  }
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y += stripHeight) {
    const rows = Math.min(stripHeight, h - y);
    sourceStripContext.clearRect(0, 0, w, stripHeight);
    sourceStripContext.drawImage(bitmap, 0, y, w, rows, 0, 0, w, rows);
    maskStripContext.clearRect(0, 0, w, stripHeight);
    maskStripContext.drawImage(maskCanvas, 0, 0, SIZE, SIZE, 0, -y, w, h);
    if (backgroundStripContext) {
      backgroundStripContext.clearRect(0, 0, w, stripHeight);
      backgroundStripContext.drawImage(background, 0, 0, SIZE, SIZE, 0, -y, w, h);
    }

    const source = sourceStripContext.getImageData(0, 0, w, rows);
    const matte = maskStripContext.getImageData(0, 0, w, rows);
    const bg = backgroundStripContext?.getImageData(0, 0, w, rows);

    for (let i = 0; i < source.data.length; i += 4) {
      const inputAlpha = source.data[i + 3] / 255;
      const maskAlpha = matte.data[i + 3] / 255;
      const outputAlpha = maskAlpha * inputAlpha;

      // A soft edge pixel is a mix of the foreground and old background.
      // Estimate the clean foreground color so that old background color
      // doesn't remain as a white or colored fringe on transparency.
      if (bg && maskAlpha > 0.03 && maskAlpha < 0.98 && inputAlpha > 0) {
        const strength = Math.min(1, (0.98 - maskAlpha) / 0.62);
        const denominator = Math.max(maskAlpha, 0.08);
        const backgroundWeight = 1 - maskAlpha;
        for (let channel = 0; channel < 3; channel++) {
          const color = source.data[i + channel];
          const clean = clampByte((color - backgroundWeight * bg.data[i + channel]) / denominator);
          source.data[i + channel] = clampByte(color + (clean - color) * strength);
        }
      }
      source.data[i + 3] = Math.round(outputAlpha * 255);
      if (cropToSubject && source.data[i + 3] > 8) {
        const pixel = i >> 2;
        const x = pixel % w;
        const py = y + ((pixel / w) | 0);
        minX = Math.min(minX, x);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, py);
      }
    }

    output.putImageData(source, 0, y);
    onStep?.("Cleaning image edges", (y + rows) / h);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  bitmap.close();
  onStep?.("Done", 1);
  if (cropToSubject) {
    if (maxX < minX || maxY < minY) {
      throw new Error("No visible subject was found. Try another image.");
    }
    const bounds = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, sourceWidth: w, sourceHeight: h };
    const cropped = canvasOf(bounds.width, bounds.height);
    cropped.getContext("2d").drawImage(full, minX, minY, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    return { blob: await toBlob(cropped), bounds };
  }
  return toBlob(full);
}

// ---------------------------------------------------------------- upscale

const OVERLAP = 8;
const MODEL_SCALE = 4;
export const UPSCALE_MAX_SIDE = 1024;

// Real-ESRGAN works on overlapping tiles, so no seams show.
// scale 2 or 4; onStep(label, 0..1). Resolves a PNG.
export async function upscale(file, onStep, scale = 2) {
  onStep?.("Loading the AI model", 0);
  const run = await session("upscale", (p) => onStep?.("Loading the AI model", p));

  // Larger tiles reduce worker round trips. The model, overlap context and
  // 4x inference stay the same; evenly spaced starts avoid a tiny final tile.
  const TILE = 192;
  const MODEL_OVERLAP = OVERLAP * 2;
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
  const alpha = new Uint8ClampedArray(pw * ph);
  let hasAlpha = false;
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = pixels[i * 4 + 3];
    if (alpha[i] < 255) hasAlpha = true;
  }
  bitmap.close();

  const S = MODEL_SCALE;
  const big = canvasOf(w * S, h * S);
  const bctx = big.getContext("2d");
  const step = TILE - MODEL_OVERLAP;
  const starts = (len) => {
    const span = len - TILE;
    if (span <= 0) return [0];
    const intervals = Math.ceil(span / step);
    return [...new Set(Array.from({ length: intervals + 1 }, (_, i) => Math.round((span * i) / intervals)))];
  };
  const xs = starts(pw);
  const ys = starts(ph);
  const total = xs.length * ys.length;
  let done = 0;

  for (let row = 0; row < ys.length; row++) {
    const y = ys[row];
    for (let col = 0; col < xs.length; col++) {
      const x = xs[col];
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
      const { data: rec } = await run(input, [1, 3, TILE, TILE]);
      const TS = TILE * S;
      const tile = new ImageData(TS, TS);
      for (let i = 0; i < TS * TS; i++) {
        tile.data[i * 4] = Math.max(0, Math.min(255, rec[i] * 255));
        tile.data[i * 4 + 1] = Math.max(0, Math.min(255, rec[TS * TS + i] * 255));
        tile.data[i * 4 + 2] = Math.max(0, Math.min(255, rec[2 * TS * TS + i] * 255));
        tile.data[i * 4 + 3] = 255;
      }
      // Keep the image borders and join tiles halfway through their shared
      // context so seam pixels are never taken from right at a tile edge.
      const left = col === 0 ? 0 : Math.floor((xs[col - 1] + TILE + x) / 2);
      const right = col === xs.length - 1 ? pw : Math.floor((x + TILE + xs[col + 1]) / 2);
      const top = row === 0 ? 0 : Math.floor((ys[row - 1] + TILE + y) / 2);
      const bottom = row === ys.length - 1 ? ph : Math.floor((y + TILE + ys[row + 1]) / 2);
      const cx = left - x;
      const cy = top - y;
      const cw = right - left;
      const ch = bottom - top;
      bctx.putImageData(tile, x * S, y * S, cx * S, cy * S, cw * S, ch * S);
      done++;
      onStep?.("Upscaling", done / total);
    }
  }

  // Real-ESRGAN enhances RGB only. Preserve transparent PNG/WebP input by
  // resizing its alpha mask separately, then applying that mask to the result.
  if (hasAlpha) {
    const mask = canvasOf(pw, ph);
    const maskContext = mask.getContext("2d");
    const maskData = maskContext.createImageData(pw, ph);
    for (let i = 0; i < alpha.length; i++) {
      const at = i * 4;
      maskData.data[at] = 255;
      maskData.data[at + 1] = 255;
      maskData.data[at + 2] = 255;
      maskData.data[at + 3] = alpha[i];
    }
    maskContext.putImageData(maskData, 0, 0);

    const scaledMask = canvasOf(w * S, h * S);
    const scaledMaskContext = scaledMask.getContext("2d");
    scaledMaskContext.imageSmoothingEnabled = true;
    scaledMaskContext.imageSmoothingQuality = "high";
    scaledMaskContext.drawImage(mask, 0, 0, pw * S, ph * S);

    bctx.globalCompositeOperation = "destination-in";
    bctx.drawImage(scaledMask, 0, 0);
    bctx.globalCompositeOperation = "source-over";
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
