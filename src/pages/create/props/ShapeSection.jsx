// A shape's or line's section: corners, sides and outline, and for a line its
// style and rounded ends.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import CreateShapePanel from "../CreateShapeToolbar";
import { toHex } from "../colorTools";

export default function ShapeSection({ ed }) {
  const { sectionClass, shapeBar, locked, cropping, active, shapeCorner, setShapeCorner, setShapeSides, setShapeWeight, setShapeColor, isLine, lineStyle, unit, setProp } = ed;
  return (
    <>
      {/* Shape or Line: corners, sides, outline and, for a line, its
          style and ends; first in the dock for a shape */}
      {shapeBar && !locked && !cropping && (
        <div className={sectionClass("shape")}>
          <p className="cp-label">{shapeBar.kind === "line" ? "Line" : "Shape"}</p>
          <CreateShapePanel
            isLine={shapeBar.kind === "line"}
            showCorner={shapeBar.kind === "rect" || shapeBar.kind === "polygon"}
            corner={shapeCorner()}
            cornerMax={Math.round(Math.min(active.getScaledWidth(), active.getScaledHeight()) / 2)}
            onCornerChange={setShapeCorner}
            showSides={shapeBar.kind === "polygon"}
            sides={shapeBar.sides ?? 3}
            onSidesChange={setShapeSides}
            stroke={toHex(typeof active.stroke === "string" && active.stroke ? active.stroke : "#000000")}
            strokeWidth={active.strokeWidth || 0}
            onStrokeChange={setShapeWeight}
            onStrokeColor={setShapeColor}
          />
      {isLine && (
        <>
          <p className="cp-label pp-sub">Line style</p>
          <div className="pp-line-styles" role="group" aria-label="Line style">
            {["solid", "dashed", "dotted"].map((style) => (
              <button
                key={style}
                type="button"
                className={lineStyle === style ? "on" : ""}
                title={`${style[0].toUpperCase()}${style.slice(1)} line`}
                aria-label={`${style[0].toUpperCase()}${style.slice(1)} line`}
                onClick={() => {
                  const unitScale = unit() / 1080;
                  const strokeDashArray = style === "solid"
                    ? null
                    : style === "dashed"
                      ? [12 * unitScale, 8 * unitScale]
                      : [2 * unitScale, 7 * unitScale];
                  setProp({ strokeDashArray });
                }}
              >
                <span className={`pp-line-sample ${style}`} />
              </button>
            ))}
          </div>
          <label className="pp-row">
            <span>Rounded ends</span>
            <input
              type="checkbox"
              checked={active.strokeLineCap === "round"}
              onChange={(e) => setProp({ strokeLineCap: e.target.checked ? "round" : "butt" })}
            />
          </label>
        </>
      )}
        </div>
      )}
    </>
  );
}
