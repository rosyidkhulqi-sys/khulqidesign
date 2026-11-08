// Footage on /admin, done in the browser so no server or FFmpeg is needed.
// Files with the same name make one clip (e.g. clip.mov master + clip.mp4).
// From the playable file we read size, length and frame rate, take a
// poster frame, and record a light preview (1280 px, up to 15 s, the
// watermark drawn into the frames for Premium). The XMP packet that
// Adobe Stock and Shutterstock read gives title, description and keywords.
// Originals go to private-files; poster, thumbnail and preview to
// public-files.
import { supabase } from "../../lib/supabaseClient";
import { uploadToR2 } from "../../lib/r2";
import { drawWatermark, shortTitle } from "./vectorUpload";

export const FOOTAGE_CATEGORIES = [
  "abstract", "background", "nature", "city", "business", "technology",
  "people", "food", "holiday", "other",
];

const PREVIEW_SECONDS = 15;
const PREVIEW_LONG_SIDE = 1280;

const baseName = (name) => name.replace(/\.[^.]+$/, "");
const extOf = (name) => name.split(".").pop().toLowerCase();
const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "clip";

export function pairFootage(fileList) {
  const groups = new Map();
  for (const file of fileList) {
    if (!["mp4", "mov", "m4v"].includes(extOf(file.name))) continue;
    const base = baseName(file.name);
    const group = groups.get(base) ?? { base, files: [] };
    group.files.push(file);
    groups.set(base, group);
  }
  return [...groups.values()].sort((a, b) => a.base.localeCompare(b.base, undefined, { numeric: true }));
}

// ---------------------------------------------------------------- reading

function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = URL.createObjectURL(file);
    const timer = setTimeout(() => fail(new Error("timeout")), 20_000);
    const done = () => {
      clearTimeout(timer);
      resolve(video);
    };
    const fail = (e) => {
      clearTimeout(timer);
      URL.revokeObjectURL(video.src);
      reject(e);
    };
    video.onloadeddata = done;
    video.onerror = () => fail(new Error("This browser can't play this file"));
  });
}

const release = (video) => {
  video.pause();
  URL.revokeObjectURL(video.src);
  video.removeAttribute("src");
  video.load();
};

// the first file of the group this browser can actually decode
export async function findPlayable(files) {
  // MP4 first: Chrome can't decode ProRes, which usually comes as .mov
  const ordered = [...files].sort((a, b) => (extOf(a.name) === "mp4" ? -1 : 0) - (extOf(b.name) === "mp4" ? -1 : 0));
  for (const file of ordered) {
    try {
      const video = await loadVideo(file);
      const info = { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
      release(video);
      if (info.width && info.height) return { file, ...info };
    } catch {
      /* try the next file */
    }
  }
  return null;
}

const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120];

// frame rate from the gaps between decoded frames (about half a second)
export async function measureFps(file) {
  const video = await loadVideo(file);
  try {
    if (!video.requestVideoFrameCallback) return null;
    const times = [];
    await new Promise((resolve) => {
      const tick = (_now, meta) => {
        times.push(meta.mediaTime);
        if (times.length < 24) video.requestVideoFrameCallback(tick);
        else resolve();
      };
      video.requestVideoFrameCallback(tick);
      video.play().catch(resolve);
      setTimeout(resolve, 2500);
    });
    const gaps = times.slice(1).map((t, i) => t - times[i]).filter((g) => g > 0).sort((a, b) => a - b);
    if (gaps.length < 5) return null;
    const fps = 1 / gaps[Math.floor(gaps.length / 2)];
    return COMMON_FPS.reduce((best, f) => (Math.abs(f - fps) < Math.abs(best - fps) ? f : best));
  } finally {
    release(video);
  }
}

// XMP is plain text inside the file; it usually sits near the start or end
export async function readFootageMeta(file) {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const chunk = 4_000_000;
  const parts = [file.slice(0, chunk)];
  if (file.size > chunk) parts.push(file.slice(Math.max(chunk, file.size - chunk)));
  for (const part of parts) {
    const text = decoder.decode(await part.arrayBuffer());
    const start = text.indexOf("<x:xmpmeta");
    const end = text.indexOf("</x:xmpmeta>", start);
    if (start === -1 || end === -1) continue;
    const doc = new DOMParser().parseFromString(text.slice(start, end + 12), "application/xml");
    const items = (tag) =>
      [...doc.getElementsByTagName(tag)].flatMap((node) =>
        [...node.getElementsByTagName("rdf:li")].map((li) => li.textContent.trim()).filter(Boolean)
      );
    const longTitle = items("dc:title")[0] || "";
    const description = items("dc:description")[0] || "";
    const keywords = [...new Set(items("dc:subject").map((k) => k.toLowerCase()))];
    if (longTitle || keywords.length) return { longTitle, description, keywords };
  }
  return { longTitle: "", description: "", keywords: [] };
}

// ------------------------------------------------------------- making images

const seek = (video, time) =>
  new Promise((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = time;
  });

const toJpeg = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the poster"))), "image/jpeg", 0.84)
  );

function fit(w, h, longSide) {
  const scale = Math.min(1, longSide / Math.max(w, h));
  // even sizes keep video encoders happy
  return [Math.round((w * scale) / 2) * 2, Math.round((h * scale) / 2) * 2];
}

export async function makePosters(file) {
  const video = await loadVideo(file);
  try {
    await seek(video, Math.min(2, video.duration / 3 || 0));
    const make = async (longSide) => {
      const [w, h] = fit(video.videoWidth, video.videoHeight, longSide);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(video, 0, 0, w, h);
      return toJpeg(canvas);
    };
    return { thumb: await make(960), poster: await make(1600) };
  } finally {
    release(video);
  }
}

function recorderType() {
  const types = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  return types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) ?? null;
}

// Plays the clip once (real time) into a canvas and records it. Keep the
// tab visible: browsers slow down hidden tabs.
export async function makePreview(file, watermark, onProgress) {
  const type = recorderType();
  if (!type) throw new Error("This browser can't record a preview; use Chrome or Safari");
  const video = await loadVideo(file);
  try {
    const [w, h] = fit(video.videoWidth, video.videoHeight, PREVIEW_LONG_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const limit = Math.min(PREVIEW_SECONDS, video.duration || PREVIEW_SECONDS);

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));

    const draw = () => {
      ctx.drawImage(video, 0, 0, w, h);
      if (watermark) drawWatermark(ctx, w, h);
    };
    draw();
    recorder.start(1000);
    await video.play();

    await new Promise((resolve, reject) => {
      // a stalled decoder must not hold the page forever
      const guard = setTimeout(() => reject(new Error("The preview stopped recording; keep this tab in front and try again")), (limit + 30) * 1000);
      const finish = () => {
        clearTimeout(guard);
        resolve();
      };
      const step = () => {
        draw();
        onProgress?.(Math.min(1, video.currentTime / limit));
        if (video.currentTime >= limit || video.ended) return finish();
        if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(step);
        else requestAnimationFrame(step);
      };
      step();
    });
    video.pause();
    recorder.stop();
    await stopped;
    const blobType = type.split(";")[0];
    return { blob: new Blob(chunks, { type: blobType }), ext: blobType === "video/mp4" ? "mp4" : "webm", width: w, height: h };
  } finally {
    release(video);
  }
}

// -------------------------------------------------------------- publishing

const newCode = () => `KD-FT-${String(Math.floor(1_000_000 + Math.random() * 9_000_000))}`;

const mime = (file) =>
  file.type || ({ mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v" }[extOf(file.name)] ?? "application/octet-stream");

export async function publishClip(item, onStep) {
  const premium = item.license === "premium";
  onStep("Making poster", 0);
  const posters = await makePosters(item.playable.file);
  const preview = await makePreview(item.playable.file, premium, (p) => onStep("Recording preview", p * 0.3));

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    const folder = `footage/${code}`;
    const name = slug(item.title);
    const originals = item.files.map((file) => ({
      bucket: "private",
      key: `${folder}/${name}.${extOf(file.name)}`,
      file,
      contentType: mime(file),
      format: extOf(file.name) === "mov" ? "MOV" : "MP4",
    }));
    const publics = [
      { bucket: "public", key: `${folder}/thumb.jpg`, file: posters.thumb, contentType: "image/jpeg" },
      { bucket: "public", key: `${folder}/poster.jpg`, file: posters.poster, contentType: "image/jpeg" },
      { bucket: "public", key: `${folder}/preview.${preview.ext}`, file: preview.blob, contentType: preview.blob.type },
    ];
    const steps = [...publics, ...originals];
    const total = steps.reduce((sum, s) => sum + s.file.size, 0);
    let done = 0;
    for (const step of steps) {
      await uploadToR2({
        ...step,
        onProgress: (p) => onStep("Uploading", 0.3 + (0.7 * (done + p * step.file.size)) / total),
      });
      done += step.file.size;
    }

    onStep("Saving", 1);
    const { width, height, duration } = item.playable;
    const { error } = await supabase.from("assets").insert({
      code,
      type: "footage",
      status: "published",
      title: item.title,
      long_title: item.longTitle || null,
      description: item.description || null,
      keywords: item.keywords,
      category: item.category,
      license: item.license,
      thumb_key: publics[0].key,
      preview_key: publics[1].key,
      preview_video_key: publics[2].key,
      files: originals.map((o) => ({
        format: o.format,
        key: o.key,
        bytes: o.file.size,
        width,
        height,
        label: o.format === "MOV" ? "Master (MOV)" : "MP4 H.264",
      })),
      width,
      height,
      duration_s: Math.round(duration * 100) / 100,
      fps: item.fps,
      orientation: width === height ? "square" : width > height ? "landscape" : "portrait",
    });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't find a free asset code, try again");
}

export { shortTitle };
