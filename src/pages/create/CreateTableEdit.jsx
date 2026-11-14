// The right panel for a selected table: rows, columns and text size in one
// row, then its style and font. Colors come from the Colors panel below.
import NumberInput from "../../components/NumberInput";
import FontPicker from "./FontPicker";
import Icon from "./CreateIcons";
import { loadFont } from "./createFonts";
import { TABLE_MAX, TABLE_STYLES } from "./createTable";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));

function CreateTableEdit({ data, onChange, onResize }) {
  const rows = data.rows.length;
  const cols = data.rows[0].length;
  return (
    <>
      <p className="cp-label">Table</p>
      <div className="pp-type is-three">
        <label title="Rows">
          <Icon name="rows" size={16} />
          <NumberInput min="1" max={TABLE_MAX} value={rows} aria-label="Rows"
            onChange={(e) => onResize(clamp(e.target.value, 1, TABLE_MAX), cols)} />
        </label>
        <label title="Columns">
          <Icon name="cols" size={16} />
          <NumberInput min="1" max={TABLE_MAX} value={cols} aria-label="Columns"
            onChange={(e) => onResize(rows, clamp(e.target.value, 1, TABLE_MAX))} />
        </label>
        <label title="Text size">
          <Icon name="fontSize" size={16} />
          <NumberInput min="6" max="200" value={data.size} aria-label="Text size"
            onChange={(e) => onChange({ size: clamp(e.target.value, 6, 200) })} />
        </label>
      </div>
      <div className="pp-seg pp-table-style" role="group" aria-label="Table style">
        {TABLE_STYLES.map(([id, label]) => (
          <button key={id} className={data.style === id ? "on" : ""} onClick={() => onChange({ style: id })}>
            {label}
          </button>
        ))}
      </div>
      <FontPicker
        value={data.font}
        onPick={async (font) => {
          await loadFont(font);
          onChange({ font });
        }}
      />
      <p className="cp-hint">Double-click a cell to type. Tab moves to the next cell.</p>
    </>
  );
}

export default CreateTableEdit;
