// The basic shape bar: corner rounding, number of sides and the outline,
// laid out in a row like Canva's, but anchored at the top right of the
// canvas area and minimized to a small tab there, as Illustrator's panels.
import Icon from "./CreateIcons";

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

export default function CreateShapeToolbar({
  collapsed,
  onToggle,
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
    <div className={`cs-toolbar ${collapsed ? "is-collapsed" : ""}`} role="group" aria-label={isLine ? "Line controls" : "Shape controls"}>
      {!collapsed && (
        <div className="cs-toolbar-controls">
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
      )}
      <button
        className="cs-toolbar-toggle"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Show shape controls" : "Minimize shape controls"}
        title={collapsed ? "Show shape controls" : "Minimize shape controls"}
      >
        {collapsed && <span>{isLine ? "Line" : "Shape"}</span>}
        <Icon name={collapsed ? "chevronLeft" : "chevronRight"} size={16} />
      </button>
    </div>
  );
}
