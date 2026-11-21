// Drives Create in headless Chrome like a person would, and records it.
// Slow motion: the page's clocks, timers and CSS animations run K times
// slower while we capture ~12 frames a second at 4K; played back K times
// faster, that is ~12*K fps of smooth video.
import { createRequire } from "module";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
const require = createRequire(new URL("../../package.json", import.meta.url));
// ffmpeg lives outside the repo (it's ~70 MB): KD_FFMPEG, or the recorder
// folder in Downloads that holds the ffmpeg-static package
export const FFMPEG = process.env.KD_FFMPEG
  || `${os.homedir()}/Downloads/Khulqidesign-YouTube/recorder/tools/node_modules/ffmpeg-static/ffmpeg`;
const WebSocket = require("ws");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const warp = (K) => `(() => {
  const K = ${K};
  if (K === 1) return;
  const pn = performance.now.bind(performance), base = pn();
  performance.now = () => base + (pn() - base) / K;
  const DN = Date.now, dbase = DN();
  Date.now = () => dbase + (DN() - dbase) / K;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => cb(base + (t - base) / K));
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (f, d = 0, ...a) => st(f, d * K, ...a);
  window.setInterval = (f, d = 0, ...a) => si(f, d * K, ...a);
})();`;

// a macOS-style arrow and a click ring, drawn by the page so they're sharp at 4K
const cursorJs = `(() => {
  if (document.getElementById("__cur")) return;
  const s = document.createElement("style");
  s.textContent = "#__cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform}" +
    "#__cur svg{display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}" +
    ".__ring{position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;" +
    "background:rgba(240,32,45,.28);border:2px solid rgba(240,32,45,.9);animation:__r .5s ease-out forwards}" +
    "@keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.25);opacity:0}}";
  document.head.appendChild(s);
  const c = document.createElement("div");
  c.id = "__cur";
  c.innerHTML = '<svg width="26" height="38" viewBox="0 0 13 19"><path d="M1 1v15.2l3.6-3.4 2.3 5.3 2.4-1-2.3-5.2h5z" fill="#000" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  window.__curAt = (x, y) => { c.style.transform = "translate(" + (x - 3) + "px," + (y - 2) + "px)"; };
  window.__ring = (x, y) => { const r = document.createElement("div"); r.className = "__ring"; r.style.left = x + "px"; r.style.top = y + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 900); };
  window.__curAt(${960}, ${560});
})();`;

export async function director({ profile, port = 9350, K = 1, scale = 1, frameDir = null }) {
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars",
    "--force-color-profile=srgb", "--lang=en-US", "--window-size=1920,1080", "about:blank"]);
  await sleep(2000);
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl, { maxPayload: 2e9 });
  await new Promise((r) => ws.on("open", r));
  let id = 0; const pend = {}; const listeners = {};
  ws.on("message", (m) => {
    const d = JSON.parse(m);
    if (pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
    else if (d.method && listeners[d.method]) listeners[d.method].forEach((f) => f(d.params));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const on = (m, f) => (listeners[m] ??= []).push(f);
  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "eval error: " + expr.slice(0, 80));
    return r.result?.result?.value;
  };

  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: scale, mobile: false });
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: warp(K) });
  await send("Animation.enable");
  // CSS transitions and animations run K times slower
  on("Animation.animationCreated", () => {});
  const setRate = () => send("Animation.setPlaybackRate", { playbackRate: 1 / K });
  await setRate();

  // ---- recording
  let rec = null;
  const frames = [];
  // input that must not overlap a screenshot (clicks were lost otherwise)
  let inflight = null, hold = null;
  const exclusive = async (fn) => {
    let release; hold = new Promise((r) => (release = r));
    await inflight;
    try { return await fn(); } finally { hold = null; release(); }
  };
  const loop = async () => {
    while (rec) {
      if (hold) await hold;
      const t = performance.now();
      inflight = send("Page.captureScreenshot", { format: "jpeg", quality: 92, optimizeForSpeed: true });
      const r = await inflight;
      if (!rec) break;
      const n = frames.length;
      const file = `${frameDir}/${String(n).padStart(6, "0")}.jpg`;
      fs.writeFile(file, Buffer.from(r.result.data, "base64"), () => {});
      frames.push({ file, t: (t - rec.start) / 1000 / K });
    }
  };
  const startRec = () => { fs.mkdirSync(frameDir, { recursive: true }); rec = { start: performance.now() }; rec.p = loop(); };
  const stopRec = async () => { const r = rec; rec = null; await r?.p; const out = { frames, duration: (performance.now() - r.start) / 1000 / K }; return out; };
  // seconds of finished video since recording started
  const now = () => (rec ? (performance.now() - rec.start) / 1000 / K : 0);

  // ---- pacing, in seconds of finished video
  const wait = (s) => sleep(s * 1000 * K);
  let cur = { x: 960, y: 560 };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const moveTo = async (x, y, s) => {
    const dist = Math.hypot(x - cur.x, y - cur.y);
    s ??= Math.min(1.1, Math.max(0.35, dist / 1400));
    const steps = Math.max(6, Math.round(s * 40));
    const from = { ...cur };
    for (let i = 1; i <= steps; i++) {
      const k = ease(i / steps);
      const px = from.x + (x - from.x) * k, py = from.y + (y - from.y) * k;
      await exclusive(async () => { await ev(`window.__curAt(${px},${py})`); await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: px, y: py }); });
      await sleep((s * 1000 * K) / steps);
    }
    cur = { x, y };
  };
  const press = async (x, y, n = 1) => {
    await ev(`window.__ring(${x},${y})`);
    await exclusive(async () => {
      for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: n });
    });
  };
  const clickAt = async (x, y, { n = 1, s } = {}) => {
    await moveTo(x, y, s);
    await wait(0.12);
    if (n === 2) { await press(x, y, 1); await wait(0.08); await press(x, y, 2); } else await press(x, y, 1);
    await wait(0.25);
  };
  const rectOf = async (js) => {
    const find = `(() => { const e = (${js}); if (!e) return null; const b = e.getBoundingClientRect(); return JSON.stringify({ x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }); })()`;
    let r = await ev(find);
    if (!r) throw new Error("not found: " + js.slice(0, 120));
    let b = JSON.parse(r);
    if (b.y < 150 || b.y > 1020) {
      // scrolled into view smoothly, as a person would
      await ev(`(${js}).scrollIntoView({ block: "center", behavior: "smooth" })`);
      await wait(0.9);
      b = JSON.parse(await ev(find));
    }
    return b;
  };
  const click = async (js, opts) => { const r = await rectOf(js); await clickAt(r.x, r.y, opts); return r; };
  // the screen position of a canvas object, found by a function of (canvas)
  const objAt = async (find) => JSON.parse(await ev(`(() => { const c = window.__kdCanvas, o = (${find})(c); if (!o) return null; const p = o.getCenterPoint(), v = c.viewportTransform, r = c.upperCanvasEl.getBoundingClientRect(); return JSON.stringify({ x: r.left + p.x * v[0] + v[4], y: r.top + p.y * v[3] + v[5], w: o.getScaledWidth() * v[0], h: o.getScaledHeight() * v[3] }); })()`));
  const type = async (text, cps = 14) => { for (const ch of text) { await exclusive(() => send("Input.insertText", { text: ch })); await sleep((1000 / cps) * K); } };
  const key = (k, code, vk, modifiers = 0) => exclusive(async () => {
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
  });
  const goto = async (url, settle = 6) => {
    await send("Page.navigate", { url });
    await sleep(settle * 1000);
    await setRate();
    await ev(cursorJs);
    await ev(`window.__curAt(${cur.x},${cur.y})`);
  };
  const shot = async (file) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(file, Buffer.from(r.result.data, "base64")); };
  // drag with a real HTML5 drag and drop
  const drag = async (from, to, s = 0.9) => {
    await moveTo(from.x, from.y);
    await wait(0.1);
    await send("Input.setInterceptDrags", { enabled: true });
    let data = null;
    on("Input.dragIntercepted", (p) => { data = p.data; });
    await exclusive(() => send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", clickCount: 1 }));
    await exclusive(() => send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + 12, y: from.y + 12, button: "left", buttons: 1 }));
    await sleep(300 * K);
    await moveTo(to.x, to.y, s);
    if (data) {
      await exclusive(() => send("Input.dispatchDragEvent", { type: "dragEnter", x: to.x, y: to.y, data }));
      await exclusive(() => send("Input.dispatchDragEvent", { type: "dragOver", x: to.x, y: to.y, data }));
      await exclusive(() => send("Input.dispatchDragEvent", { type: "drop", x: to.x, y: to.y, data }));
    }
    await exclusive(() => send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", clickCount: 1 }));
    await send("Input.setInterceptDrags", { enabled: false });
    await wait(0.3);
    return !!data;
  };

  // waits (in real time) until a page expression is truthy
  const waitFor = async (js, secs = 8) => {
    for (let i = 0; i < secs * 10; i++) { if (await ev(`!!(${js})`)) return true; await sleep(100); }
    return false;
  };
  // a held-down mouse drag on the page (moving or resizing on the canvas)
  const dragMouse = async (from, to, s = 0.8) => {
    await moveTo(from.x, from.y);
    await wait(0.15);
    await exclusive(() => send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", buttons: 1, clickCount: 1 }));
    const steps = Math.max(8, Math.round(s * 40));
    for (let i = 1; i <= steps; i++) {
      const k = ease(i / steps);
      const px = from.x + (to.x - from.x) * k, py = from.y + (to.y - from.y) * k;
      await exclusive(async () => { await ev(`window.__curAt(${px},${py})`); await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: px, y: py, button: "left", buttons: 1 }); });
      await sleep((s * 1000 * K) / steps);
    }
    await exclusive(() => send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", buttons: 0, clickCount: 1 }));
    cur = { x: to.x, y: to.y };
    await wait(0.3);
  };
  // design units on the page to a point on screen
  const toScreen = async (x, y) => JSON.parse(await ev(`(() => { const c = window.__kdCanvas, v = c.viewportTransform, r = c.upperCanvasEl.getBoundingClientRect(); return JSON.stringify({ x: r.left + ${x} * v[0] + v[4], y: r.top + ${y} * v[3] + v[5] }); })()`));

  // clicks something that opens a file chooser, and answers it with files
  const upload = async (js, files) => {
    await send("Page.setInterceptFileChooserDialog", { enabled: true });
    let node = null;
    on("Page.fileChooserOpened", (p) => { node = p.backendNodeId; });
    await click(js);
    for (let i = 0; i < 40 && !node; i++) await sleep(50);
    if (node) await send("DOM.setFileInputFiles", { files, backendNodeId: node });
    await send("Page.setInterceptFileChooserDialog", { enabled: false });
    return !!node;
  };

  const close = () => { ws.close(); chrome.kill(); };
  return { waitFor, dragMouse, toScreen, upload, send, ev, on, wait, moveTo, clickAt, click, rectOf, objAt, type, key, goto, shot, drag, startRec, stopRec, now, close, K, get cur() { return cur; } };
}
