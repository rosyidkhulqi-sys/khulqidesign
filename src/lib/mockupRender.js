// Draws a mockup from its kit (scripts/mockup-kit): designs placed on the
// scene the way Photoshop places smart objects. Each slot's design goes
// through its 4x4 Bezier warp mesh and its perspective quad, is masked, and
// gets its Shading (Multiply) and Gloss (Screen) only where the design is;
// reflections reuse their design; occluders go on top. The same steps as
// scripts/mockup-kit/kitrender.py, which matches Photoshop's previews.
//
// It needs no browser: the caller hands in makeCanvas(w, h) and, for
// loadKit, loadImage(url), so the same code runs in Create and in tests.

const GRID = 24; // mesh cells per side

/* ---------- geometry ---------- */

// the 3x3 perspective map taking the 4 src points onto the 4 dst points
export function homography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let r = col + 1; r < 8; r++) {
      const f = A[r][col] / A[col][col];
      for (let k = col; k < 8; k++) A[r][k] -= f * A[col][k];
      b[r] -= f * b[col];
    }
  }
  const h = new Array(8);
  for (let r = 7; r >= 0; r--) {
    let sum = b[r];
    for (let k = r + 1; k < 8; k++) sum -= A[r][k] * h[k];
    h[r] = sum / A[r][r];
  }
  return [...h, 1];
}

const project = (H, x, y) => {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
};

const bern = (t) => {
  const s = 1 - t;
  return [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t];
};

// (n+1) x (n+1) kit-pixel points of a slot's warped design grid, row by row
export function slotGrid(slot, n = GRID) {
  const [x0, y0, x1, y1] = slot.bounds;
  const q = slot.quad;
  const H = homography([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [[q[0], q[1]], [q[2], q[3]], [q[4], q[5]], [q[6], q[7]]]);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const bv = bern(i / n);
    for (let j = 0; j <= n; j++) {
      const bu = bern(j / n);
      let x = 0;
      let y = 0;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const w = bv[r] * bu[c];
          x += w * slot.mesh[r * 4 + c][0];
          y += w * slot.mesh[r * 4 + c][1];
        }
      }
      pts.push(project(H, x, y));
    }
  }
  return pts;
}

/* ---------- drawing ---------- */

// draws the src triangle of img onto the dst triangle (affine per triangle;
// the cells are small, so the curve and perspective hold)
function drawTriangle(ctx, img, s0, s1, s2, d0, d1, d2) {
  // a touch larger than the triangle, so neighbours leave no hairline seams
  const cx = (d0[0] + d1[0] + d2[0]) / 3;
  const cy = (d0[1] + d1[1] + d2[1]) / 3;
  const grow = (p) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / len) * 0.75, p[1] + (dy / len) * 0.75];
  };
  const [g0, g1, g2] = [grow(d0), grow(d1), grow(d2)];
  // the affine map src -> dst: d = [a c e; b d f] * s
  const det = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
  if (!det) return;
  const solve = (k) => [
    (k[0] * (s1[1] - s2[1]) + k[1] * (s2[1] - s0[1]) + k[2] * (s0[1] - s1[1])) / det,
    (k[0] * (s2[0] - s1[0]) + k[1] * (s0[0] - s2[0]) + k[2] * (s1[0] - s0[0])) / det,
    (k[0] * (s1[0] * s2[1] - s2[0] * s1[1]) + k[1] * (s2[0] * s0[1] - s0[0] * s2[1]) + k[2] * (s0[0] * s1[1] - s1[0] * s0[1])) / det,
  ];
  const [a, c, e] = solve([d0[0], d1[0], d2[0]]);
  const [b, d, f] = solve([d0[1], d1[1], d2[1]]);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g0[0], g0[1]);
  ctx.lineTo(g1[0], g1[1]);
  ctx.lineTo(g2[0], g2[1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// a slot's design warped onto a canvas the size of the slot's box
function warpSlot(slot, design, content, makeCanvas, n = GRID) {
  const [bx, by, bw, bh] = slot.box;
  const out = makeCanvas(bw, bh);
  const ctx = out.getContext("2d");
  const pts = slotGrid(slot, n);
  const sx = design.width / content[0];
  const sy = design.height / content[1];
  const at = (i, j) => {
    const p = pts[i * (n + 1) + j];
    return [p[0] - bx, p[1] - by];
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const s00 = [(j / n) * content[0] * sx, (i / n) * content[1] * sy];
      const s10 = [((j + 1) / n) * content[0] * sx, (i / n) * content[1] * sy];
      const s11 = [((j + 1) / n) * content[0] * sx, ((i + 1) / n) * content[1] * sy];
      const s01 = [(j / n) * content[0] * sx, ((i + 1) / n) * content[1] * sy];
      drawTriangle(ctx, design, s00, s10, s11, at(i, j), at(i, j + 1), at(i + 1, j + 1));
      drawTriangle(ctx, design, s00, s11, s01, at(i, j), at(i + 1, j + 1), at(i + 1, j));
    }
  }
  return out;
}

// a grayscale mask as an alpha mask (white = shown)
export function maskToAlpha(img, makeCanvas) {
  const c = makeCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i + 3] = px[i];
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

const OP = { multiply: "multiply", screen: "screen", normal: "source-over" };

/**
 * The mockup as a canvas the kit's size.
 * kit: kit.json; images: what loadKit loaded; designs[n]: an image or canvas
 * for design n, or null for its sample; makeCanvas(w, h).
 */
export function renderMockup({ kit, images, designs = [], makeCanvas, grid = GRID }) {
  const [W, H] = kit.size;
  const out = makeCanvas(W, H);
  const ctx = out.getContext("2d");
  ctx.drawImage(images.base, 0, 0, W, H);
  kit.slots.forEach((slot, i) => {
    const design = designs[slot.design] || images.samples[slot.design];
    if (!design) return;
    const [bx, by, bw, bh] = slot.box;
    // the design, warped and masked: its alpha is also the clip for Shading/Gloss
    const layer = warpSlot(slot, design, kit.designs[slot.design].content, makeCanvas, grid);
    const lctx = layer.getContext("2d");
    lctx.globalCompositeOperation = "destination-in";
    lctx.drawImage(images.masks[i], 0, 0, bw, bh);
    ctx.save();
    ctx.globalAlpha = slot.opacity;
    ctx.globalCompositeOperation = OP[slot.blend] || "source-over";
    ctx.drawImage(layer, bx, by);
    ctx.restore();
    slot.clips.forEach((clip, j) => {
      const t = makeCanvas(bw, bh);
      const tctx = t.getContext("2d");
      tctx.drawImage(images.clips[i][j], 0, 0, bw, bh);
      tctx.globalCompositeOperation = "destination-in";
      tctx.drawImage(layer, 0, 0);
      ctx.save();
      ctx.globalAlpha = clip.opacity;
      ctx.globalCompositeOperation = OP[clip.blend] || "source-over";
      ctx.drawImage(t, bx, by);
      ctx.restore();
    });
  });
  if (kit.occluders) {
    const [ox, oy, ow, oh] = kit.occluders.box;
    ctx.drawImage(images.occluders, ox, oy, ow, oh);
  }
  return out;
}

/**
 * A kit and its pictures. base: the kit folder's address (ending in "/");
 * loadImage(url) resolves an image; makeCanvas(w, h) for the masks.
 */
export async function loadKit(base, loadImage, makeCanvas, fetchJson = (url) => fetch(url).then((r) => r.json())) {
  const kit = await fetchJson(`${base}kit.json`);
  const [baseImg, masks, clips, samples, occluders] = await Promise.all([
    loadImage(base + kit.base),
    Promise.all(kit.slots.map((s) => loadImage(base + s.mask).then((m) => maskToAlpha(m, makeCanvas)))),
    Promise.all(kit.slots.map((s) => Promise.all(s.clips.map((c) => loadImage(base + c.file))))),
    Promise.all(kit.designs.map((_, n) => loadImage(`${base}d${n}-sample.png`))),
    kit.occluders ? loadImage(base + kit.occluders.file) : null,
  ]);
  return { kit, images: { base: baseImg, masks, clips, samples, occluders } };
}
