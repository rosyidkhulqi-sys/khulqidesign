import Icon from "./CreateIcons";

function RangeControl({ label, value, min = 0, max, onChange }) {
  return (
    <label className="cs-range-control">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
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
    <div className={`cs-toolbar ${collapsed ? "is-collapsed" : ""}`} role="group" aria-label="Basic shape controls">
      {!collapsed && (
        <div className="cs-toolbar-controls">
          {showCorner && (
            <RangeControl
              label="Corner rounding"
              value={corner}
              max={cornerMax}
              onChange={onCornerChange}
            />
          )}
          {showSides && (
            <RangeControl
              label="Sides"
              value={sides}
              min={3}
              max={20}
              onChange={onSidesChange}
            />
          )}
          <div className="cs-stroke-control">
            <span>Stroke</span>
            <button
              className="cs-stroke-color"
              style={{ backgroundColor: typeof stroke === "string" ? stroke : "#000000" }}
              onClick={onStrokeColor}
              title="Edit stroke color"
              aria-label="Edit stroke color"
            />
            <RangeControl
              label="Weight"
              value={strokeWidth}
              max={48}
              onChange={onStrokeChange}
            />
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
        {collapsed && <span>Shape</span>}
        <Icon name={collapsed ? "chevronLeft" : "chevronRight"} size={16} />
      </button>
    </div>
  );
}
