// Animated page export for Create: the open page, frame by frame, as an MP4
// or a GIF, made in the browser. Each frame poses the elements (frameAt),
// draws the page off screen at the file's size and puts the design back, so
// the page on screen never moves while it's made.
import { frameAt, pageLength } from "./createAnimate";

const FPS = { mp4: 30, gif: 15 };
// the longest side of the file: full size for video up to 1920, smaller
// for GIF, which grows fast with size
const MAX_SIDE = { mp4: 1920, gif: 720 };

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

// size of the file for a page of w × h
export function motionSize(format, w, h) {
  const s = Math.min(1, MAX_SIDE[format] / Math.max(w, h));
  return { width: even(w * s), height: even(h * s) };
}

// calls draw(frameCanvas, n, total) for every frame
async function eachFrame(canvas, board, format, draw) {
  const objects = canvas.getObjects();
  const seconds = pageLength(objects);
  const fps = FPS[format];
  const total = Math.max(1, Math.round(seconds * fps));
  const { width, height } = motionSize(format, board.w, board.h);
  const multiplier = width / board.w / canvas.getZoom();

  const frame = document.createElement("canvas");
  frame.width = width;
  frame.height = height;
  const ctx = frame.getContext("2d", { willReadFrequently: format === "gif" });

  for (let n = 0; n < total; n++) {
    const undo = frameAt(objects, n / fps);
    let page;
    try {
      page = canvas.toCanvasElement(multiplier);
    } finally {
      undo();
    }
    // a page without a background color sits on white: video has no
    // see-through
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(page, 0, 0, width, height);
    await draw(frame, ctx, n, total, fps);
    // let the page breathe between frames
    if (n % 10 === 9) await new Promise((r) => setTimeout(r, 0));
  }
  return { width, height };
}

// Resolves a Blob; onProgress(0..1)
export async function buildPageMp4(canvas, board, onProgress) {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH, canEncodeVideo } = await import("mediabunny");
  const size = motionSize("mp4", board.w, board.h);
  const ok = await canEncodeVideo("avc", { ...size, bitrate: QUALITY_HIGH }).catch(() => false);
  if (!ok) throw new Error("This browser can't make MP4 files. Try the latest Chrome, Edge or Safari, or download a GIF.");

  let output;
  let source;
  await eachFrame(canvas, board, "mp4", async (frame, _ctx, n, total, fps) => {
    if (!output) {
      output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
      source = new CanvasSource(frame, { codec: "avc", bitrate: QUALITY_HIGH });
      output.addVideoTrack(source, { frameRate: fps });
      await output.start();
    }
    await source.add(n / fps, 1 / fps);
    onProgress?.((n + 1) / total);
  });
  await output.finalize();
  return new Blob([output.target.buffer], { type: "video/mp4" });
}

// Resolves a Blob; onProgress(0..1). The GIF loops.
export async function buildPageGif(canvas, board, onProgress) {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  const { width, height } = motionSize("gif", board.w, board.h);
  await eachFrame(canvas, board, "gif", (_frame, ctx, n, total, fps) => {
    const { data } = ctx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: 1000 / fps, repeat: 0 });
    onProgress?.((n + 1) / total);
  });
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
