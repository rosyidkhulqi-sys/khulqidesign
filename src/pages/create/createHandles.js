// The selection handles in Create: small white dots at the corners, slim
// pills on the sides and a thin outline, as modern editors draw them, in
// place of fabric's hollow squares. Imported once for its effect.
import { FabricObject, InteractiveFabricObject, Textbox, util } from "fabric";

const ACCENT = "#5b8cff";

Object.assign(InteractiveFabricObject.ownDefaults, {
  transparentCorners: false,
  cornerStyle: "circle",
  cornerSize: 11,
  touchCornerSize: 28,
  cornerColor: "#ffffff",
  cornerStrokeColor: "rgba(15, 17, 20, 0.28)",
  borderColor: ACCENT,
  borderScaleFactor: 1.5,
  padding: 2,
  // rotation clicks into 0°, 45°, 90°… when it comes within 5° of them
  snapAngle: 45,
  snapThreshold: 5,
});

// a short rounded bar along the edge, turned with the object
function renderPill(ctx, left, top, _style, object) {
  const along = this.x === 0 ? "x" : "y";
  const w = along === "x" ? 18 : 6;
  const h = along === "x" ? 6 : 18;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(util.degreesToRadians(object.getTotalAngle()));
  ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
  ctx.shadowBlur = 3;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(15, 17, 20, 0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 3);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.stroke();
  ctx.restore();
}

// the rotate handle: a white dot with a small turning arrow in it
function renderRotate(ctx, left, top) {
  ctx.save();
  ctx.translate(left, top);
  ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
  ctx.shadowBlur = 3;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(15, 17, 20, 0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = "#1d1f23";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 4, Math.PI * 0.15, Math.PI * 1.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4.2, -3.6);
  ctx.lineTo(4.4, 0.6);
  ctx.lineTo(0.6, -1);
  ctx.stroke();
  ctx.restore();
}

function restyle(controls) {
  for (const [key, control] of Object.entries(controls)) {
    if (["ml", "mr", "mt", "mb"].includes(key)) control.render = renderPill;
    // under the object, as in Canva: the toolbar above it would hide it
    if (key === "mtr") {
      control.render = renderRotate;
      control.withConnection = false;
      control.y = 0.5;
      control.offsetY = 30;
    }
  }
  return controls;
}

for (const Klass of [FabricObject, Textbox]) {
  const make = Klass.createControls;
  Klass.createControls = function createControls() {
    const result = make.call(this);
    restyle(result.controls);
    return result;
  };
}
