// Animate in Create: each element can have an entrance ("in") and a motion
// that keeps going after it ("loop"), stored on the element as kdAnim =
// { in, loop }. A short list on purpose: the six entrances and three loops
// people use most, not a wall of presets.
//
// poseAt() says how an element looks at a moment; playPage() plays the page
// on the canvas itself, and frameAt() poses every element for one frame of
// an export. The design is never changed: each frame starts from the
// element's own state and puts it back afterwards.
import { FabricObject, Point } from "fabric";

export const ENTRANCES = [
  ["rise", "Rise"],
  ["pan", "Pan"],
  ["fade", "Fade"],
  ["pop", "Pop"],
  ["wipe", "Wipe"],
  ["blur", "Blur"],
];

export const LOOPS = [
  ["pulse", "Pulse"],
  ["rotate", "Rotate"],
  ["wiggle", "Wiggle"],
];

const IN_SECONDS = 0.7; // one entrance
const STAGGER = 0.2; // between elements, top to bottom
const HOLD = 1.5; // the finished page stays this long
const LOOP_SECONDS = 3; // with a loop, the page plays at least this long after the entrances

const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const easeBack = (p) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Wipe and Blur need the canvas itself (a clip and a blur filter), so every
// element's drawing checks for them; without them it draws as before.
let patched = false;
function patchRender() {
  if (patched) return;
  patched = true;
  const draw = FabricObject.prototype.render;
  FabricObject.prototype.render = function (ctx) {
    const wipe = this.__kdWipe;
    const blur = this.__kdBlur;
    if (wipe == null && !blur) return draw.call(this, ctx);
    ctx.save();
    if (wipe != null) {
      const b = this.getBoundingRect();
      ctx.beginPath();
      ctx.rect(b.left, b.top, b.width * wipe, b.height);
      ctx.clip();
    }
    if (blur) ctx.filter = `blur(${blur}px)`;
    draw.call(this, ctx);
    ctx.restore();
  };
}

// the moment each animated element starts: top to bottom, left to right
function scheduleOf(objects) {
  const moving = objects.filter((o) => o.kdAnim?.in || o.kdAnim?.loop);
  const order = [...moving].sort((a, b) => {
    const pa = a.getBoundingRect();
    const pb = b.getBoundingRect();
    return Math.abs(pa.top - pb.top) > 8 ? pa.top - pb.top : pa.left - pb.left;
  });
  let n = 0;
  return new Map(order.map((o) => [o, o.kdAnim?.in ? STAGGER * n++ : 0]));
}

// how long the page plays
export function pageLength(objects) {
  const starts = scheduleOf(objects);
  if (!starts.size) return 0;
  const lastIn = Math.max(...[...starts.values()]) + IN_SECONDS;
  const loops = [...starts.keys()].some((o) => o.kdAnim?.loop);
  return lastIn + (loops ? LOOP_SECONDS : HOLD);
}

export const hasAnimation = (objects) => objects.some((o) => o.kdAnim?.in || o.kdAnim?.loop);

// the change from an element's own state at time t (seconds since it starts)
function poseAt(anim, t, size) {
  const pose = { dx: 0, dy: 0, scale: 1, angle: 0, opacity: 1, wipe: null, blur: 0 };
  if (anim.in) {
    const p = clamp01(t / IN_SECONDS);
    const e = easeOut(p);
    if (anim.in === "rise") { pose.dy = size * 0.25 * (1 - e); pose.opacity = e; }
    if (anim.in === "pan") { pose.dx = -size * 0.35 * (1 - e); pose.opacity = e; }
    if (anim.in === "fade") pose.opacity = e;
    if (anim.in === "pop") { pose.scale = 0.5 + 0.5 * easeBack(p); pose.opacity = clamp01(p * 3); }
    if (anim.in === "wipe" && p < 1) pose.wipe = e;
    if (anim.in === "blur") { pose.blur = 24 * (1 - e); pose.opacity = e; }
  }
  // the loop starts once the element is in
  const lt = t - (anim.in ? IN_SECONDS : 0);
  if (anim.loop && lt > 0) {
    if (anim.loop === "pulse") pose.scale *= 1 + 0.06 * Math.sin((lt / 1.2) * Math.PI * 2);
    if (anim.loop === "rotate") pose.angle += (lt / 4) * 360;
    if (anim.loop === "wiggle") pose.angle += 6 * Math.sin((lt / 0.5) * Math.PI * 2) * Math.min(1, lt * 4);
  }
  return pose;
}

// every animated element in its pose at time `seconds` (or only those in
// `only`, one element or a list); returns a function that puts them all back
export function frameAt(objects, seconds, only = null) {
  patchRender();
  const starts = scheduleOf(only ? [].concat(only) : objects);
  const saved = [];
  for (const [obj, start] of starts) {
    const base = {
      left: obj.left,
      top: obj.top,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      angle: obj.angle,
      opacity: obj.opacity,
    };
    saved.push([obj, base]);
    const t = seconds - start;
    const b = obj.getBoundingRect();
    const pose = t < 0
      ? { dx: 0, dy: 0, scale: 1, angle: 0, opacity: obj.kdAnim.in ? 0 : 1, wipe: null, blur: 0 }
      : poseAt(obj.kdAnim, t, Math.max(b.width, b.height));
    // in the element's own parent plane: inside a selection of several,
    // positions are relative to the selection, not the page
    const center = obj.getRelativeCenterPoint();
    obj.set({
      scaleX: base.scaleX * pose.scale,
      scaleY: base.scaleY * pose.scale,
      angle: base.angle + pose.angle,
      opacity: base.opacity * pose.opacity,
    });
    obj.setPositionByOrigin(new Point(center.x + pose.dx, center.y + pose.dy), "center", "center");
    obj.__kdWipe = pose.wipe;
    obj.__kdBlur = pose.blur;
  }
  return () => {
    for (const [obj, base] of saved) {
      obj.set(base);
      obj.__kdWipe = null;
      obj.__kdBlur = 0;
      obj.setCoords();
    }
  };
}

// Plays the page (or one element) on the canvas. Returns stop().
export function playPage(canvas, { only = null, onEnd } = {}) {
  const objects = canvas.getObjects();
  const length = pageLength(only ? [].concat(only) : objects);
  if (!length) {
    onEnd?.();
    return () => {};
  }
  // the selection stays (so its panel stays open) but its handles hide, and
  // the page can't be touched until the preview ends; a key or a click ends it
  const top = canvas.upperCanvasEl;
  top.style.visibility = "hidden";
  // the selection's outline and handles hide too, and in a selection of
  // several, each element's own outline
  const picked = canvas.getActiveObject();
  const outlined = picked ? [picked, ...(picked.getObjects?.() ?? [])] : [];
  const shown = outlined.map((o) => ({ hasBorders: o.hasBorders, hasControls: o.hasControls }));
  outlined.forEach((o) => o.set({ hasBorders: false, hasControls: false }));
  const started = performance.now();
  let frame = 0;
  let undo = null;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    undo?.();
    top.style.visibility = "";
    outlined.forEach((o, i) => o.set(shown[i]));
    window.removeEventListener("keydown", finish, true);
    window.removeEventListener("pointerdown", finish, true);
    canvas.requestRenderAll();
    onEnd?.();
  };
  window.addEventListener("keydown", finish, true);
  window.addEventListener("pointerdown", finish, true);

  const tick = (now) => {
    undo?.();
    const seconds = (now - started) / 1000;
    if (seconds >= length) return finish();
    undo = frameAt(objects, seconds, only);
    canvas.renderAll();
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return finish;
}
