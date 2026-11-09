// Turns an icon and a motion preset into a Lottie JSON file, in the browser.
// Unlike the other exports this rebuilds the drawing: every SVG shape becomes
// Lottie bezier paths, and each preset is written as Lottie keyframes with the
// same timing as the studio's CSS. Loaded only when someone exports one.
import svgpath from "svgpath";
import { FILE_PX, ICON_SHARE } from "./animateExport";

const FPS = 60;
const DRAWABLE = "path, circle, rect, ellipse, line, polyline, polygon";
const HIDDEN = "defs, clipPath, mask, symbol, pattern, marker";
// things Lottie paths can't carry; better to say so than export a wrong icon
const UNSUPPORTED = "image, text, use, foreignObject, [clip-path], [mask], [filter]";

const EASE_IN_OUT = [0.42, 0, 0.58, 1];
const EASE_SPIN = [0.6, 0, 0.4, 1];
const EASE_BUILD = [0.3, 1.4, 0.5, 1];

// The studio's whole-icon presets. [percent of the time, value(s)]; distances
// are percent of the icon's size. Each interval eases on its own, as in CSS.
const MOTIONS = {
  bounce: {
    y: [[0, 0], [30, -16], [50, 0], [65, -5], [100, 0]],
    scale: [[0, 100, 100], [30, 100, 100], [50, 104, 96], [65, 100, 100], [100, 100, 100]],
  },
  pop: {
    scale: [[0, 60, 60], [45, 112, 112], [70, 96, 96], [100, 100, 100]],
    opacity: [[0, 0], [45, 100], [100, 100]],
  },
  spin: { rotate: [[0, 0], [100, 360]], ease: EASE_SPIN },
  shake: {
    x: [[0, 0], [20, -5], [40, 5], [60, -3], [80, 3], [100, 0]],
    rotate: [[0, 0], [20, -6], [40, 6], [60, -3], [80, 3], [100, 0]],
  },
  pulse: { scale: [[0, 100, 100], [50, 112, 112], [100, 100, 100]] },
  float: { y: [[0, 0], [50, -8], [100, 0]] },
  swing: { rotate: [[0, 0], [25, 12], [75, -12], [100, 0]], originY: 0.1 },
};

const round = (n) => Number(n.toFixed(3));
const fixed = (k) => ({ a: 0, k });

// one animated property; frames: [[time in frames, value array], ...].
// Position takes single easing numbers, the other properties one per value.
function animated(frames, [x1, y1, x2, y2], { position = false } = {}) {
  const shape = (n, size) => (position ? n : Array(size).fill(n));
  return {
    a: 1,
    k: frames.map(([t, s], i) => {
      if (i === frames.length - 1) return { t: round(t), s };
      const size = s.length;
      return {
        t: round(t),
        s,
        o: { x: shape(x1, size), y: shape(y1, size) },
        i: { x: shape(x2, size), y: shape(y2, size) },
      };
    }),
  };
}

const groupTransform = () => ({
  ty: "tr",
  p: fixed([0, 0]),
  a: fixed([0, 0]),
  s: fixed([100, 100]),
  r: fixed(0),
  o: fixed(100),
  sk: fixed(0),
  sa: fixed(0),
});

// ------------------------------------------------------- shapes to paths

function pathData(el) {
  const num = (name) => parseFloat(el.getAttribute(name)) || 0;
  switch (el.tagName.toLowerCase()) {
    case "path":
      return el.getAttribute("d") || "";
    case "circle": {
      const [cx, cy, r] = [num("cx"), num("cy"), num("r")];
      return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
    }
    case "ellipse": {
      const [cx, cy, rx, ry] = [num("cx"), num("cy"), num("rx"), num("ry")];
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    case "rect": {
      const [x, y, w, h] = [num("x"), num("y"), num("width"), num("height")];
      let rx = el.hasAttribute("rx") ? num("rx") : num("ry");
      let ry = el.hasAttribute("ry") ? num("ry") : num("rx");
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}`
        + `A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}`
        + `V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    case "line":
      return `M${num("x1")} ${num("y1")}L${num("x2")} ${num("y2")}`;
    case "polyline":
    case "polygon": {
      const points = (el.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
      let d = "";
      for (let i = 0; i + 1 < points.length; i += 2) d += `${i ? "L" : "M"}${points[i]} ${points[i + 1]}`;
      return el.tagName.toLowerCase() === "polygon" ? `${d}Z` : d;
    }
    default:
      return "";
  }
}

// the shape's subpaths as Lottie paths, in the file's 512 px space
function toContours(el) {
  const m = el.getCTM();
  const contours = [];
  let current = null;

  const addVertex = (x, y, inX = 0, inY = 0) => {
    current.v.push([x, y]);
    current.i.push([inX, inY]);
    current.o.push([0, 0]);
  };

  svgpath(pathData(el))
    .abs()
    .unarc()
    .unshort()
    .matrix([m.a, m.b, m.c, m.d, m.e, m.f])
    .abs()
    .iterate((seg, _i, x, y) => {
      const [cmd, ...a] = seg;
      if (cmd === "M") {
        current = { v: [], i: [], o: [], c: false };
        contours.push(current);
        addVertex(a[0], a[1]);
      } else if (!current) {
        return;
      } else if (cmd === "L") {
        addVertex(a[0], a[1]);
      } else if (cmd === "H") {
        addVertex(a[0], y);
      } else if (cmd === "V") {
        addVertex(x, a[0]);
      } else if (cmd === "C" || cmd === "Q") {
        // a quadratic curve is written as the cubic it equals
        const [c1x, c1y, c2x, c2y, ex, ey] = cmd === "C"
          ? a
          : [x + (2 / 3) * (a[0] - x), y + (2 / 3) * (a[1] - y),
             a[2] + (2 / 3) * (a[0] - a[2]), a[3] + (2 / 3) * (a[1] - a[3]), a[2], a[3]];
        current.o[current.o.length - 1] = [c1x - x, c1y - y];
        addVertex(ex, ey, c2x - ex, c2y - ey);
      } else if (cmd === "Z") {
        current.c = true;
        const last = current.v.length - 1;
        // a closing point on top of the first one merges into it
        if (last > 0 && Math.hypot(current.v[last][0] - current.v[0][0], current.v[last][1] - current.v[0][1]) < 0.01) {
          current.i[0] = current.i[last];
          current.v.pop();
          current.i.pop();
          current.o.pop();
        }
      }
    });

  for (const c of contours) {
    for (const list of [c.v, c.i, c.o]) list.forEach((p, i) => (list[i] = [round(p[0]), round(p[1])]));
  }
  return contours.filter((c) => c.v.length > 1);
}

// ---------------------------------------------------------------- paint

function parseColor(text) {
  const n = text.match(/-?[\d.]+%?/g)?.map(parseFloat);
  if (!n || n.length < 3) return null;
  return { rgb: [n[0] / 255, n[1] / 255, n[2] / 255].map(round), alpha: n[3] ?? 1 };
}

// opacity of the element and of every group around it
function treeOpacity(el, root) {
  let value = 1;
  for (let node = el; node && node !== root; node = node.parentElement) {
    value *= parseFloat(getComputedStyle(node).opacity);
  }
  return value;
}

function gradientOf(id, el, root) {
  let g = root.querySelector(`[id="${CSS.escape(id)}"]`);
  if (!g) return null;
  const attr = (name) => {
    for (let node = g, depth = 0; node && depth < 8; depth++) {
      if (node.hasAttribute(name)) return node.getAttribute(name);
      const ref = node.getAttribute("href") || node.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      node = ref ? root.querySelector(`[id="${CSS.escape(ref.slice(1))}"]`) : null;
    }
    return null;
  };

  let stopsFrom = g;
  for (let depth = 0; depth < 8 && !stopsFrom.querySelector("stop"); depth++) {
    const ref = stopsFrom.getAttribute("href") || stopsFrom.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    const next = ref && root.querySelector(`[id="${CSS.escape(ref.slice(1))}"]`);
    if (!next) break;
    stopsFrom = next;
  }
  const stops = [...stopsFrom.querySelectorAll("stop")].map((s) => {
    const cs = getComputedStyle(s);
    const raw = s.getAttribute("offset") || "0";
    const offset = raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw);
    const color = parseColor(cs.stopColor) ?? { rgb: [0, 0, 0], alpha: 1 };
    return { offset: round(offset), rgb: color.rgb, alpha: color.alpha * parseFloat(cs.stopOpacity) };
  });
  if (!stops.length) return null;

  const linear = g.tagName.toLowerCase() === "lineargradient";
  const box = el.getBBox();
  const inBox = attr("gradientUnits") !== "userSpaceOnUse";
  const read = (name, fallback) => {
    const raw = attr(name);
    const n = raw === null ? fallback : raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw);
    return n;
  };
  const place = (px, py) => (inBox ? [box.x + px * box.width, box.y + py * box.height] : [px, py]);

  const [from, to] = linear
    ? [place(read("x1", 0), read("y1", 0)), place(read("x2", 1), read("y2", 0))]
    : [place(read("cx", 0.5), read("cy", 0.5)), place(read("cx", 0.5) + read("r", 0.5), read("cy", 0.5))];

  const own = g.gradientTransform.baseVal.consolidate()?.matrix;
  const m = own ? el.getCTM().multiply(own) : el.getCTM();
  const map = ([px, py]) => [round(m.a * px + m.c * py + m.e), round(m.b * px + m.d * py + m.f)];
  return { type: linear ? 1 : 2, from: map(from), to: map(to), stops };
}

function paintOf(el, root) {
  const cs = getComputedStyle(el);
  const base = treeOpacity(el, root);
  const scale = Math.sqrt(Math.abs(el.getCTM().a * el.getCTM().d - el.getCTM().b * el.getCTM().c));

  const read = (value) => {
    if (value === "none") return null;
    const ref = value.match(/url\(["']?#([^"')]+)/);
    if (ref) {
      const gradient = gradientOf(ref[1], el, root);
      if (gradient) return { gradient };
      const fallback = value.replace(/url\([^)]*\)/, "").trim();
      return fallback && fallback !== "none" ? { color: parseColor(fallback) } : null;
    }
    return { color: parseColor(value) };
  };

  const fill = read(cs.fill);
  const stroke = read(cs.stroke);
  return {
    fill: fill && { ...fill, opacity: base * parseFloat(cs.fillOpacity), rule: cs.fillRule === "evenodd" ? 2 : 1 },
    stroke: stroke && parseFloat(cs.strokeWidth) > 0 ? {
      ...stroke,
      opacity: base * parseFloat(cs.strokeOpacity),
      width: round(parseFloat(cs.strokeWidth) * scale),
      cap: { butt: 1, round: 2, square: 3 }[cs.strokeLinecap] ?? 1,
      join: { miter: 1, round: 2, bevel: 3 }[cs.strokeLinejoin] ?? 1,
      miter: parseFloat(cs.strokeMiterlimit) || 4,
    } : null,
  };
}

const flatColor = (paint) => {
  if (paint.color) return [...paint.color.rgb, 1];
  return [...paint.gradient.stops[0].rgb, 1];
};

function fillItem(paint, opacity) {
  const o = opacity ?? fixed(round(paint.opacity * (paint.color?.alpha ?? 1) * 100));
  if (paint.gradient) {
    const { type, from, to, stops } = paint.gradient;
    const colors = stops.flatMap((s) => [s.offset, ...s.rgb]);
    const alphas = stops.some((s) => s.alpha < 1) ? stops.flatMap((s) => [s.offset, round(s.alpha)]) : [];
    return { ty: "gf", o, r: paint.rule, t: type, s: fixed(from), e: fixed(to), g: { p: stops.length, k: fixed([...colors, ...alphas]) } };
  }
  return { ty: "fl", c: fixed(flatColor(paint)), o, r: paint.rule };
}

function strokeItem(paint, opacity) {
  const o = opacity ?? fixed(round(paint.opacity * (paint.color?.alpha ?? 1) * 100));
  return { ty: "st", c: fixed(flatColor(paint)), o, w: fixed(paint.width), lc: paint.cap, lj: paint.join, ml: paint.miter };
}

const pathItems = (contours) => contours.map((k) => ({ ty: "sh", ks: fixed(k) }));

// what one SVG shape looks like, as a Lottie group
function plainGroup(shape) {
  const it = pathItems(shape.contours);
  if (shape.paint.stroke) it.push(strokeItem(shape.paint.stroke));
  if (shape.paint.fill) it.push(fillItem(shape.paint.fill));
  it.push(groupTransform());
  return { ty: "gr", it };
}

// ------------------------------------------------------------- layers

function layer(index, name, shapes, transform, end) {
  return {
    ddd: 0,
    ind: index,
    ty: 4,
    nm: name,
    sr: 1,
    ks: { o: fixed(100), r: fixed(0), p: fixed([FILE_PX / 2, FILE_PX / 2, 0]), a: fixed([FILE_PX / 2, FILE_PX / 2, 0]), s: fixed([100, 100, 100]), ...transform },
    ao: 0,
    shapes,
    ip: 0,
    op: end,
    st: 0,
    bm: 0,
  };
}

function wholeIconLayers(preset, shapes, duration) {
  const motion = MOTIONS[preset];
  const ease = motion.ease ?? EASE_IN_OUT;
  const end = duration * FPS;
  const at = (percent) => (percent / 100) * end;
  const unit = FILE_PX * ICON_SHARE;
  const center = FILE_PX / 2;
  const anchorY = motion.originY === undefined ? center : center - unit / 2 + unit * motion.originY;
  const transform = { a: fixed([center, anchorY, 0]), p: fixed([center, anchorY, 0]) };

  if (motion.x || motion.y) {
    const keys = motion.x ?? motion.y;
    transform.p = animated(
      keys.map(([p, v]) => {
        const moved = (v / 100) * unit;
        return [at(p), [center + (motion.x ? moved : 0), anchorY + (motion.y ? moved : 0), 0]];
      }),
      ease,
      { position: true },
    );
  }
  if (motion.scale) transform.s = animated(motion.scale.map(([p, sx, sy]) => [at(p), [sx, sy, 100]]), ease);
  if (motion.rotate) transform.r = animated(motion.rotate.map(([p, v]) => [at(p), [v]]), ease);
  if (motion.opacity) transform.o = animated(motion.opacity.map(([p, v]) => [at(p), [v]]), ease);

  const op = Math.ceil(end);
  return { layers: [layer(1, "Icon", [...shapes].reverse().map(plainGroup), transform, op)], op };
}

// the box around a set of paths, following the curves
function centerOf(shapes) {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const see = (x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const { contours } of shapes) {
    for (const c of contours) {
      const n = c.v.length;
      for (let i = 0; i < (c.c ? n : n - 1); i++) {
        const a = c.v[i];
        const b = c.v[(i + 1) % n];
        const p1 = [a[0] + c.o[i][0], a[1] + c.o[i][1]];
        const p2 = [b[0] + c.i[(i + 1) % n][0], b[1] + c.i[(i + 1) % n][1]];
        for (let s = 0; s <= 12; s++) {
          const t = s / 12;
          const u = 1 - t;
          const f = (d) => u * u * u * a[d] + 3 * u * u * t * p1[d] + 3 * u * t * t * p2[d] + t * t * t * b[d];
          see(f(0), f(1));
        }
      }
    }
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

// Build: each part of the icon pops in after the one before it
function buildLayers(parts, duration) {
  const length = duration * FPS;
  const step = (length * 0.6) / Math.max(1, parts.length);
  const op = Math.ceil(length + step * (parts.length - 1));
  const layers = parts.map((shapes, i) => {
    const start = i * step;
    const [cx, cy] = centerOf(shapes);
    const peak = start + length * 0.6;
    return layer(i + 1, `Part ${i + 1}`, [...shapes].reverse().map(plainGroup), {
      a: fixed([round(cx), round(cy), 0]),
      p: fixed([round(cx), round(cy), 0]),
      s: animated([[start, [0, 0, 100]], [peak, [100, 100, 100]]], EASE_BUILD),
      o: animated([[start, [0]], [peak, [100]]], EASE_BUILD),
    }, op);
  });
  return { layers: layers.reverse(), op };
}

// where a cubic-bezier easing is at x (0..1)
function easedAt(x, [x1, y1, x2, y2]) {
  const axis = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (axis(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  return axis(y1, y2, (lo + hi) / 2);
}

function contourLength(c) {
  const n = c.v.length;
  let total = 0;
  for (let i = 0; i < (c.c ? n : n - 1); i++) {
    const a = c.v[i];
    const b = c.v[(i + 1) % n];
    const p1 = [a[0] + c.o[i][0], a[1] + c.o[i][1]];
    const p2 = [b[0] + c.i[(i + 1) % n][0], b[1] + c.i[(i + 1) % n][1]];
    let last = a;
    for (let s = 1; s <= 16; s++) {
      const t = s / 16;
      const u = 1 - t;
      const f = (d) => u * u * u * a[d] + 3 * u * u * t * p1[d] + 3 * u * t * t * p2[d] + t * t * t * b[d];
      const point = [f(0), f(1)];
      total += Math.hypot(point[0] - last[0], point[1] - last[1]);
      last = point;
    }
  }
  return total;
}

// Every subpath of a shape is traced at the same pen speed, as the preview's
// dashed line does, so short ones finish first. Trim can't express that with
// easing alone, so the curve is written out as straight keyframes.
function traceKeys(length, totalLength, at) {
  const steps = 12;
  const keys = [];
  for (let j = 0; j <= steps; j++) {
    const x = j / steps;
    const percent = Math.min(100, (easedAt(x, EASE_IN_OUT) * totalLength * 100) / Math.max(length, 0.001));
    keys.push([at(x * 55), [round(percent)]]);
    if (percent >= 100) break;
  }
  return keys;
}

// Draw: a line traces each shape, then its color comes in
function drawLayers(shapes, duration, unit) {
  const length = duration * 1.8 * FPS;
  const step = (duration * FPS * 0.4) / Math.max(1, shapes.length);
  const op = Math.ceil(length + step * (shapes.length - 1));

  const groups = shapes.map(({ contours, paint }, i) => {
    const start = i * step;
    const at = (percent) => start + (percent / 100) * length;
    const groupsForShape = [];
    const borrowed = !paint.stroke;
    const line = paint.stroke ?? (paint.fill && {
      ...paint.fill,
      opacity: 1,
      width: round(unit / 160),
      cap: 1,
      join: 1,
      miter: 4,
    });

    if (line) {
      const lengths = contours.map(contourLength);
      const totalLength = lengths.reduce((sum, n) => sum + n, 0);
      const fade = borrowed
        ? animated([[at(0), [100]], [at(55), [100]], [at(75), [0]]], EASE_IN_OUT)
        : undefined;
      contours.forEach((contour, c) => {
        groupsForShape.push({
          ty: "gr",
          it: [
            ...pathItems([contour]),
            { ty: "tm", s: fixed(0), e: animated(traceKeys(lengths[c], totalLength, at), [0, 0, 1, 1]), o: fixed(0), m: 1 },
            strokeItem(line, fade),
            groupTransform(),
          ],
        });
      });
    }

    if (paint.fill) {
      const full = round(paint.fill.opacity * (paint.fill.color?.alpha ?? 1) * 100);
      groupsForShape.push({
        ty: "gr",
        it: [
          ...pathItems(contours),
          fillItem(paint.fill, animated([[at(0), [0]], [at(55), [0]], [at(75), [full]]], EASE_IN_OUT)),
          groupTransform(),
        ],
      });
    }
    return groupsForShape;
  });

  return { layers: [layer(1, "Icon", groups.reverse().flat(), {}, op)], op };
}

// ------------------------------------------------------------- the file

// the icon's top-level parts, stepping inside a single wrapping <g>, as the
// studio's Build preset does
function partsOf(svg) {
  let root = svg;
  while (root.children.length === 1 && root.firstElementChild.tagName.toLowerCase() === "g") {
    root = root.firstElementChild;
  }
  return [...root.children].filter((el) => !/^(defs|lineargradient|radialgradient|style|title|desc|metadata)$/i.test(el.tagName));
}

const leavesOf = (el) =>
  (el.matches(DRAWABLE) ? [el] : [...el.querySelectorAll(DRAWABLE)]).filter((node) => !node.closest(HIDDEN));

// source: { viewBox, inner } from loadIconSvg. Returns the file's text.
export function buildLottie(source, { preset, duration, name }) {
  const [x, y, width, height] = source.viewBox.trim().split(/[\s,]+/).map(Number);
  const iconUnits = Math.max(width, height);
  const size = iconUnits / ICON_SHARE;
  const cx = x + width / 2;
  const cy = y + height / 2;

  // a clean hidden copy: the studio's own has the preview's styles on it
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${FILE_PX}px;height:${FILE_PX}px`;
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${FILE_PX}" height="${FILE_PX}" viewBox="${cx - size / 2} ${cy - size / 2} ${size} ${size}">${source.inner}</svg>`;
  document.body.appendChild(host);

  try {
    const svg = host.firstElementChild;
    if (svg.querySelector(UNSUPPORTED)) {
      throw new Error("This icon uses effects Lottie can't carry yet. Try GIF, MP4 or Animated SVG.");
    }

    const read = (el) => ({ contours: toContours(el), paint: paintOf(el, svg) });
    const usable = (shape) => shape.contours.length && (shape.paint.fill || shape.paint.stroke);
    const parts = partsOf(svg).map((part) => leavesOf(part).map(read).filter(usable)).filter((p) => p.length);
    const shapes = parts.flat();
    if (!shapes.length) throw new Error("This icon has no shapes to export.");

    const seconds = round(duration);
    const unit = FILE_PX * ICON_SHARE;
    let result;
    if (preset === "build") result = buildLayers(parts, seconds);
    else if (preset === "draw") result = drawLayers(shapes, seconds, unit);
    else result = wholeIconLayers(preset, shapes, seconds);

    return JSON.stringify({
      v: "5.7.4",
      fr: FPS,
      ip: 0,
      op: result.op,
      w: FILE_PX,
      h: FILE_PX,
      nm: name,
      ddd: 0,
      assets: [],
      layers: result.layers,
    });
  } finally {
    host.remove();
  }
}
