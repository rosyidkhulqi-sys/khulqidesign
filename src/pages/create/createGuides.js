// Smart guides for the Create canvas: while an element is dragged, its edges
// and center snap to the artboard's and to other elements', and a line shows
// what it lined up with. Hold Cmd or Ctrl to move freely.
//
// The lines are drawn only on the on-screen canvas, so they never reach saved
// designs, thumbnails or downloads.

const SNAP_PX = 6;
const COLOR = "#f0202d";

// a box's three stops on one axis: start, middle, end
const stops = (start, size) => [start, start + size / 2, start + size];

// the smallest nudge that puts one of `own` on one of `targets`, or null
function nearest(own, targets, reach) {
  let best = null;
  for (const a of own) {
    for (const b of targets) {
      const delta = b - a;
      if (Math.abs(delta) <= reach && (best === null || Math.abs(delta) < Math.abs(best))) best = delta;
    }
  }
  return best;
}

// canvas: the fabric Canvas. getBoard() -> { w, h }. Returns the detach function.
export function attachGuides(canvas, getBoard) {
  let lines = { x: [], y: [] };

  const clear = () => {
    if (!lines.x.length && !lines.y.length) return;
    lines = { x: [], y: [] };
    canvas.requestRenderAll();
  };

  const onMoving = ({ target, e }) => {
    if (e?.metaKey || e?.ctrlKey) return clear();
    target.setCoords();
    const box = target.getBoundingRect();
    const board = getBoard();
    const reach = SNAP_PX / canvas.getZoom();

    const xs = [0, board.w / 2, board.w];
    const ys = [0, board.h / 2, board.h];
    for (const other of canvas.getObjects()) {
      // the elements being dragged together don't guide themselves
      if (other === target || other.group === target || !other.visible) continue;
      other.setCoords();
      const r = other.getBoundingRect();
      xs.push(...stops(r.left, r.width));
      ys.push(...stops(r.top, r.height));
    }

    const dx = nearest(stops(box.left, box.width), xs, reach) ?? 0;
    const dy = nearest(stops(box.top, box.height), ys, reach) ?? 0;
    if (dx || dy) {
      target.set({ left: target.left + dx, top: target.top + dy });
      target.setCoords();
    }

    const snapped = target.getBoundingRect();
    const onLine = (own, targets) => [...new Set(targets.filter((t) => own.some((a) => Math.abs(a - t) < 0.5)))];
    lines = {
      x: onLine(stops(snapped.left, snapped.width), xs),
      y: onLine(stops(snapped.top, snapped.height), ys),
    };
  };

  const onAfterRender = ({ ctx }) => {
    if (!lines.x.length && !lines.y.length) return;
    // only on the canvas on screen: thumbnails and downloads render elsewhere
    if (ctx !== canvas.getContext()) return;
    const zoom = canvas.getZoom();
    const board = getBoard();
    ctx.save();
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of lines.x) {
      const px = Math.round(x * zoom) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, board.h * zoom);
    }
    for (const y of lines.y) {
      const px = Math.round(y * zoom) + 0.5;
      ctx.moveTo(0, px);
      ctx.lineTo(board.w * zoom, px);
    }
    ctx.stroke();
    ctx.restore();
  };

  canvas.on("object:moving", onMoving);
  canvas.on("after:render", onAfterRender);
  canvas.on("mouse:up", clear);

  return () => {
    canvas.off("object:moving", onMoving);
    canvas.off("after:render", onAfterRender);
    canvas.off("mouse:up", clear);
  };
}
