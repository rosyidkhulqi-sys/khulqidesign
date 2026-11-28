// The Shape (or Line) section of the right dock: corner rounding, number of
// sides and the outline, one control per row, as Illustrator keeps corner
// radius in its Properties panel. It used to float at the top right of the
// canvas; in the dock every setting has one place and the canvas stays clear.

function RangeControl({ label, value, min = 0, max, onChange }) {
  return (
    <label className="cs-range-control">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={Math.max(min, max)}
        step="1"
        value={Math.max(min, Math.min(max, Number(value) || 0))}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{Math.round(value)}</output>
    </label>
  );
}

export default function CreateShapePanel({
  isLine = false,
  showCorner,
  corner,
  cornerMax,
  onCornerChange,
  showSides,
  sides,
  onSidesChange,
  stroke,
  strokeWidth,
  onStrokeChange,
  onStrokeColor,
}) {
  return (
    <div className="cs-panel" role="group" aria-label={isLine ? "Line controls" : "Shape controls"}>
      {showCorner && (
        <RangeControl label="Corners" value={corner} max={cornerMax} onChange={onCornerChange} />
      )}
      {showSides && (
        <RangeControl label="Sides" value={sides} min={3} max={20} onChange={onSidesChange} />
      )}
      <div className="cs-stroke-control">
        <label className="cs-stroke-color" title={isLine ? "Line color" : "Outline color"}>
          <input type="color" value={stroke} onChange={(event) => onStrokeColor(event.target.value)}
                 aria-label={isLine ? "Line color" : "Outline color"} />
          <span style={{ backgroundColor: stroke }} />
        </label>
        <RangeControl label={isLine ? "Weight" : "Outline"} value={strokeWidth} min={isLine ? 1 : 0} max={48} onChange={onStrokeChange} />
      </div>
    </div>
  );
}
