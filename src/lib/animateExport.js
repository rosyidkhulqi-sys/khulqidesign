// Turns the icon playing in the Animate studio into one self-contained
// animated SVG file. It starts from the live preview, so Build and Draw keep
// the per-part delays and dash lengths the studio worked out.

const SVG_NS = "http://www.w3.org/2000/svg";

// the file's size, and the share of it the icon fills, as on the artboard;
// the margin leaves room for the motion
const FILE_PX = 512;
const ICON_SHARE = 0.6;

const round = (n) => Number(n.toFixed(2));

// the studio's whole-icon presets, with distances in the file's own units
function wholeIconFrames(preset, unit) {
  const d = (percent) => `${round((percent / 100) * unit)}px`;
  return {
    bounce: `0%,100%{transform:translateY(0)}30%{transform:translateY(${d(-16)})}50%{transform:translateY(0) scale(1.04,.96)}65%{transform:translateY(${d(-5)})}`,
    pop: "0%{transform:scale(.6);opacity:0}45%{transform:scale(1.12);opacity:1}70%{transform:scale(.96)}100%{transform:scale(1)}",
    spin: "from{transform:rotate(0deg)}to{transform:rotate(360deg)}",
    shake: `0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(${d(-5)}) rotate(-6deg)}40%{transform:translateX(${d(5)}) rotate(6deg)}60%{transform:translateX(${d(-3)}) rotate(-3deg)}80%{transform:translateX(${d(3)}) rotate(3deg)}`,
    pulse: "0%,100%{transform:scale(1)}50%{transform:scale(1.12)}",
    float: `0%,100%{transform:translateY(0)}50%{transform:translateY(${d(-8)})}`,
    swing: "0%,100%{transform:rotate(0)}25%{transform:rotate(12deg)}75%{transform:rotate(-12deg)}",
  }[preset];
}

function stylesFor(preset, { duration, loop, center, unit }) {
  const repeat = loop ? "infinite" : "1";

  if (preset === "build") {
    return ".kd-part{transform-box:fill-box;transform-origin:50% 50%;"
      + `animation:kd-build ${duration}s cubic-bezier(.3,1.4,.5,1) ${repeat} both}`
      + "@keyframes kd-build{0%{transform:scale(0);opacity:0}60%,100%{transform:scale(1);opacity:1}}";
  }

  if (preset === "draw") {
    return `.kd-draw{animation:kd-draw ${round(duration * 1.8)}s ease-in-out ${repeat} both}`
      + ".kd-trace{animation-name:kd-draw-trace}"
      + "@keyframes kd-draw{0%{fill-opacity:0}55%{stroke-dashoffset:0;fill-opacity:0}75%,100%{stroke-dashoffset:0;fill-opacity:1}}"
      + "@keyframes kd-draw-trace{0%{fill-opacity:0;stroke-opacity:1}55%{stroke-dashoffset:0;fill-opacity:0;stroke-opacity:1}75%,100%{stroke-dashoffset:0;fill-opacity:1;stroke-opacity:0}}";
  }

  const easing = preset === "spin" ? "cubic-bezier(.6,0,.4,1)" : "ease-in-out";
  // Swing hangs from near the top of the icon
  const originY = preset === "swing" ? center - unit / 2 + unit * 0.1 : center;
  return `.kd-i{transform-box:view-box;transform-origin:${round(center)}px ${round(originY)}px;`
    + `animation:kd-m ${duration}s ${easing} ${repeat} both}`
    + `@keyframes kd-m{${wholeIconFrames(preset, unit)}}`;
}

// iconEl: the <svg> in the studio's stage. Returns the file's text.
export function buildAnimatedSvg(iconEl, { preset, duration, loop }) {
  const { x, y, width, height } = iconEl.viewBox.baseVal;
  const unit = Math.max(width, height);
  const size = unit / ICON_SHARE;
  const center = size / 2;

  const root = document.createElementNS(SVG_NS, "svg");
  root.setAttribute("viewBox", `0 0 ${round(size)} ${round(size)}`);
  root.setAttribute("width", String(FILE_PX));
  root.setAttribute("height", String(FILE_PX));

  const style = document.createElementNS(SVG_NS, "style");
  style.textContent = stylesFor(preset, { duration: round(duration), loop, center, unit });
  root.appendChild(style);

  const motion = document.createElementNS(SVG_NS, "g");
  motion.setAttribute("class", "kd-i");
  // puts the icon's own coordinates in the middle of the file
  const place = document.createElementNS(SVG_NS, "g");
  place.setAttribute("transform", `translate(${round(center - x - width / 2)} ${round(center - y - height / 2)})`);
  for (const node of iconEl.childNodes) place.appendChild(node.cloneNode(true));
  motion.appendChild(place);
  root.appendChild(motion);

  return new XMLSerializer().serializeToString(root);
}

// ---------------------------------------------------------- GIF and MP4

const VIDEO_FPS = 30;
const GIF_FPS = 20;
// with Loop on, a clip plays over and over until it lasts about this long,
// since a one-second video is hard to use on its own
const MP4_LOOP_SECONDS = 5;

const PROPS = ["transform", "opacity", "fillOpacity", "strokeOpacity", "strokeDashoffset"];

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This frame couldn't be drawn"));
    img.src = url;
  });

// A hidden copy of the animation that can be stopped at any moment. Each
// moment is frozen into a still SVG (a picture of a running animation can't
// be asked for a given time) and drawn on a white canvas.
// A clip is whole passes of the motion, so it loops cleanly; passesFor(seconds)
// says how many, given how long one takes.
async function renderFrames(iconEl, options, fps, passesFor, onFrame) {
  const file = buildAnimatedSvg(iconEl, { ...options, loop: false });
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${FILE_PX}px;height:${FILE_PX}px`;
  host.innerHTML = file;
  document.body.appendChild(host);

  try {
    const live = host.firstElementChild;
    const animations = live.getAnimations({ subtree: true });
    animations.forEach((a) => a.pause());
    const length = Math.max(...animations.map((a) => a.effect.getComputedTiming().endTime));
    const perPass = Math.max(1, Math.round((length / 1000) * fps));

    const nodes = [...live.querySelectorAll("*")];
    const moving = [...new Set(animations.map((a) => a.effect.target))];

    const canvas = document.createElement("canvas");
    canvas.width = FILE_PX;
    canvas.height = FILE_PX;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const total = perPass * passesFor(length / 1000);

    for (let n = 0; n < total; n++) {
      // the last frame lands on the end of the motion
      const t = perPass > 1 ? ((n % perPass) / (perPass - 1)) * length : length;
      animations.forEach((a) => (a.currentTime = t));

      const still = live.cloneNode(true);
      const copies = still.querySelectorAll("*");
      for (const el of moving) {
        const seen = getComputedStyle(el);
        const copy = copies[nodes.indexOf(el)];
        copy.style.animation = "none";
        for (const prop of PROPS) copy.style[prop] = seen[prop];
      }

      const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(still)], { type: "image/svg+xml" })
      );
      try {
        const img = await loadImage(url);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, FILE_PX, FILE_PX);
        ctx.drawImage(img, 0, 0, FILE_PX, FILE_PX);
      } finally {
        URL.revokeObjectURL(url);
      }
      await onFrame(canvas, ctx, n, total);
    }
  } finally {
    host.remove();
  }
}

// onProgress(0..1). Resolves a GIF Blob.
export async function buildGif(iconEl, options, onProgress) {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  await renderFrames(iconEl, options, GIF_FPS, () => 1, (_canvas, ctx, n, total) => {
    const { data } = ctx.getImageData(0, 0, FILE_PX, FILE_PX);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), FILE_PX, FILE_PX, {
      palette,
      delay: 1000 / GIF_FPS,
      repeat: options.loop ? 0 : -1,
    });
    onProgress?.((n + 1) / total);
  });
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

// onProgress(0..1). Resolves an MP4 Blob, or throws where the browser has no
// H.264 encoder.
export async function buildMp4(iconEl, options, onProgress) {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH, canEncodeVideo } = await import("mediabunny");
  const supported = await canEncodeVideo("avc", { width: FILE_PX, height: FILE_PX, bitrate: QUALITY_HIGH }).catch(() => false);
  if (!supported) throw new Error("This browser can't make MP4 files. Try the latest Chrome, Edge or Safari, or export a GIF.");

  const passesFor = (seconds) => (options.loop ? Math.max(1, Math.ceil(MP4_LOOP_SECONDS / seconds)) : 1);

  let output;
  let source;
  await renderFrames(iconEl, options, VIDEO_FPS, passesFor, async (canvas, _ctx, n, total) => {
    if (!output) {
      output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
      source = new CanvasSource(canvas, { codec: "avc", bitrate: QUALITY_HIGH });
      output.addVideoTrack(source, { frameRate: VIDEO_FPS });
      await output.start();
    }
    await source.add(n / VIDEO_FPS, 1 / VIDEO_FPS);
    onProgress?.((n + 1) / total);
  });
  await output.finalize();
  return new Blob([output.target.buffer], { type: "video/mp4" });
}
