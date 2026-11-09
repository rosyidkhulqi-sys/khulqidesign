// The Colors row of the inspector. Each swatch keeps hold of the fills it
// started with, so dragging in the color picker can pass over another color
// of the design without merging the two, and the swatch stays mounted (a
// remounted input closes the browser's picker mid-drag).
import { useState } from "react";
import { paletteOf } from "./colorTools";

const MAX_SWATCHES = 10;

const signature = (entries) => [...new Set(entries.map((e) => e.color))].sort().join();

function CreateColors({ object, onChange }) {
  const [state, setState] = useState(() => ({ object, entries: paletteOf(object) }));

  // another element was selected, or its colors changed some other way
  let { entries } = state;
  const live = paletteOf(object);
  if (state.object !== object || signature(entries) !== signature(live)) {
    entries = live;
    setState({ object, entries });
  }

  if (entries.length === 0) return null;

  const change = (index, color) => {
    entries[index].targets.forEach(([leaf, prop]) => leaf.set(prop, color));
    setState({ object, entries: entries.map((e, i) => (i === index ? { ...e, color } : e)) });
    onChange();
  };

  return (
    <>
      <p className="cp-label">Colors</p>
      <div className="pp-colors">
        {entries.slice(0, MAX_SWATCHES).map((e, i) => (
          <input key={i} type="color" value={e.color} onChange={(ev) => change(i, ev.target.value)} />
        ))}
      </div>
    </>
  );
}

export default CreateColors;
