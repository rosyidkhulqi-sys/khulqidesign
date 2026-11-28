// The canvas tool strip's drawing, apart from the React wiring in Create:
// how the canvas behaves for each tool, and dragging out a shape or a line
// (Shift for a square or 45° steps; a click without a drag gives the usual
// size). unit is the page's shorter side, so sizes suit any page.
import { Line, PencilBrush, Rect } from "fabric";

// the tools that draw on a press instead of picking up what's under it
export const isDrawTool = (tool) => tool === "shape" || tool === "line" || tool === "text";

// sets the canvas up for a tool: the pencil draws freely, the drawing tools
// get a crosshair and no selection box, Select picks things as usual
export function setCanvasTool(c, tool, unit) {
  const drawTool = isDrawTool(tool);
  c.isDrawingMode = tool === "pencil";
  if (tool === "pencil") {
    const brush = new PencilBrush(c);
    brush.color = "#111111";
    brush.width = Math.max(2, unit * 0.006);
    c.freeDrawingBrush = brush;
  }
  c.selection = !drawTool;
  c.skipTargetFind = drawTool;
  c.defaultCursor = drawTool ? "crosshair" : "default";
  if (drawTool || tool === "pencil") {
    c.discardActiveObject();
    c.requestRenderAll();
  }
}

// a shape or line starting at point p: on the page, not yet pickable
export function beginDraw(c, kind, p, unit) {
  const obj = kind === "line"
    ? new Line([p.x, p.y, p.x, p.y], { fill: null, stroke: "#000000", strokeWidth: Math.max(2, unit * 0.004), strokeLineCap: "round" })
    : new Rect({ left: p.x, top: p.y, width: 1, height: 1, fill: "#000000", strokeWidth: 0 });
  obj.set({ selectable: false, evented: false });
  c.add(obj);
  return { obj, x: p.x, y: p.y, kind };
}

// the drag reaching point p
export function dragDraw(c, d, p, shift) {
  let dx = p.x - d.x;
  let dy = p.y - d.y;
  if (d.kind === "line") {
    // Shift: straight along 45° steps
    if (shift) {
      const step = Math.PI / 4;
      const angle = Math.round(Math.atan2(dy, dx) / step) * step;
      const length = Math.hypot(dx, dy);
      dx = Math.cos(angle) * length;
      dy = Math.sin(angle) * length;
    }
    d.obj.set({ x2: d.x + dx, y2: d.y + dy });
  } else {
    // Shift: a square
    if (shift) {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx || 1) * side;
      dy = Math.sign(dy || 1) * side;
    }
    d.obj.set({ left: Math.min(d.x, d.x + dx), top: Math.min(d.y, d.y + dy), width: Math.abs(dx), height: Math.abs(dy) });
  }
  d.obj.setCoords();
  c.requestRenderAll();
}

// the drag let go: the finished object, pickable
export function endDraw(d, unit) {
  const { obj } = d;
  // a click without a drag gives the usual size, centered on the click
  const tiny = Math.max(obj.getScaledWidth(), obj.getScaledHeight()) < unit * 0.01;
  if (tiny) {
    const s = unit * 0.3;
    if (d.kind === "line") obj.set({ x1: d.x - s * 0.75, y1: d.y, x2: d.x + s * 0.75, y2: d.y });
    else obj.set({ left: d.x - s / 2, top: d.y - s / 2, width: s, height: s });
  }
  obj.set({ selectable: true, evented: true });
  obj.setCoords();
  return obj;
}
