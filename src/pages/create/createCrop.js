// Cropping a picture on the Create canvas. While cropping, the whole picture
// is shown with a frame on top; the part outside the frame is dimmed. The
// frame stays inside the picture, also when the picture is rotated or flipped.
import { Point, Rect, util } from "fabric";

const MIN_PX = 8;

// canvas, image: a selected FabricImage. Returns { apply(), cancel() }, one
// of which ends the crop.
export function beginCrop(canvas, image) {
  const before = {
    cropX: image.cropX,
    cropY: image.cropY,
    width: image.width,
    height: image.height,
    left: image.left,
    top: image.top,
  };
  const original = image.getOriginalSize();
  const startMatrix = image.calcTransformMatrix();
  const visibleCenter = image.getCenterPoint();

  // show the whole picture, with what was visible staying exactly in place
  const shift = new Point(
    original.width / 2 - (before.cropX + before.width / 2),
    original.height / 2 - (before.cropY + before.height / 2),
  ).transform(startMatrix);
  image.set({ cropX: 0, cropY: 0, width: original.width, height: original.height, dirty: true });
  image.setPositionByOrigin(shift, "center", "center");
  image.setCoords();

  const frame = new Rect({
    left: visibleCenter.x,
    top: visibleCenter.y,
    originX: "center",
    originY: "center",
    width: before.width,
    height: before.height,
    scaleX: image.scaleX,
    scaleY: image.scaleY,
    angle: image.angle,
    fill: "transparent",
    strokeWidth: 0,
    objectCaching: false,
    excludeFromExport: true,
    lockRotation: true,
    lockScalingFlip: true,
    transparentCorners: false,
    cornerColor: "#ffffff",
    cornerStrokeColor: "#ffffff",
    borderColor: "#ffffff",
    cornerSize: 12,
    isCropFrame: true,
  });
  frame.setControlsVisibility({ mtr: false });

  // dim everything of the picture outside the frame, and draw the thirds
  frame._render = function render(ctx) {
    const toFrame = util.invertTransform(this.calcTransformMatrix());
    const corners = image.getCoords().map((p) => p.transform(toFrame));
    const [w, h] = [this.width, this.height];
    ctx.save();
    ctx.beginPath();
    corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = "rgba(10, 10, 12, 0.62)";
    ctx.fill("evenodd");

    ctx.beginPath();
    for (const part of [1 / 3, 2 / 3]) {
      ctx.moveTo(-w / 2 + w * part, -h / 2);
      ctx.lineTo(-w / 2 + w * part, h / 2);
      ctx.moveTo(-w / 2, -h / 2 + h * part);
      ctx.lineTo(w / 2, -h / 2 + h * part);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1 / (Math.max(this.scaleX, this.scaleY) * canvas.getZoom());
    ctx.stroke();
    ctx.restore();
  };

  // the frame as a box in the picture's own pixels, with (0,0) at its center
  const scaleX = () => Math.abs(image.scaleX);
  const scaleY = () => Math.abs(image.scaleY);
  const frameBox = () => {
    const toImage = util.invertTransform(image.calcTransformMatrix());
    const c = frame.getCenterPoint().transform(toImage);
    return { x: c.x, y: c.y, w: frame.getScaledWidth() / scaleX(), h: frame.getScaledHeight() / scaleY() };
  };
  const placeFrame = ({ x, y, w, h }) => {
    const center = new Point(x, y).transform(image.calcTransformMatrix());
    frame.set({
      left: center.x,
      top: center.y,
      scaleX: (w * scaleX()) / frame.width,
      scaleY: (h * scaleY()) / frame.height,
    });
    frame.setCoords();
  };

  const halfW = original.width / 2;
  const halfH = original.height / 2;
  const between = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // moving keeps the size and stops at the picture's edge
  const onMoving = ({ target }) => {
    if (target !== frame) return;
    const b = frameBox();
    placeFrame({
      ...b,
      x: between(b.x, -halfW + b.w / 2, halfW - b.w / 2),
      y: between(b.y, -halfH + b.h / 2, halfH - b.h / 2),
    });
  };

  // resizing cuts off whatever goes past the picture's edge
  const onScaling = ({ target }) => {
    if (target !== frame) return;
    const b = frameBox();
    const x0 = Math.max(b.x - b.w / 2, -halfW);
    const x1 = Math.min(b.x + b.w / 2, halfW);
    const y0 = Math.max(b.y - b.h / 2, -halfH);
    const y1 = Math.min(b.y + b.h / 2, halfH);
    const w = Math.max(x1 - x0, MIN_PX);
    const h = Math.max(y1 - y0, MIN_PX);
    placeFrame({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, w, h });
  };

  // a click outside the frame doesn't end the crop
  const keepSelected = () => {
    canvas.setActiveObject(frame);
    canvas.requestRenderAll();
  };

  // nothing else can be picked while cropping
  const others = canvas.getObjects().map((o) => [o, o.evented, o.selectable]);
  others.forEach(([o]) => o.set({ evented: false, selectable: false }));
  const canvasBefore = { selection: canvas.selection, uniformScaling: canvas.uniformScaling };
  canvas.selection = false;
  canvas.uniformScaling = false;

  canvas.on("object:moving", onMoving);
  canvas.on("object:scaling", onScaling);
  canvas.on("selection:cleared", keepSelected);
  canvas.add(frame);
  canvas.setActiveObject(frame);
  canvas.requestRenderAll();

  const finish = () => {
    canvas.off("object:moving", onMoving);
    canvas.off("object:scaling", onScaling);
    canvas.off("selection:cleared", keepSelected);
    canvas.discardActiveObject();
    canvas.remove(frame);
    others.forEach(([o, evented, selectable]) => o.set({ evented, selectable }));
    Object.assign(canvas, canvasBefore);
    image.setCoords();
    canvas.setActiveObject(image);
    canvas.requestRenderAll();
  };

  return {
    apply() {
      const b = frameBox();
      const center = frame.getCenterPoint();
      image.set({
        cropX: b.x - b.w / 2 + halfW,
        cropY: b.y - b.h / 2 + halfH,
        width: b.w,
        height: b.h,
        dirty: true,
      });
      image.setPositionByOrigin(center, "center", "center");
      finish();
    },
    cancel() {
      image.set({ ...before, dirty: true });
      finish();
    },
  };
}
