// The Layers panel: every element of the page, top one first. Click to
// select, drag to reorder, and hide or lock each one.
import { useState } from "react";
import { Circle, FabricImage, Group, Line, Rect, Textbox, Triangle } from "fabric";
import Icon from "./CreateIcons";

// a steady key per element, since elements carry no id of their own
const keys = new WeakMap();
let nextKey = 1;
const keyOf = (obj) => {
  if (!keys.has(obj)) keys.set(obj, nextKey++);
  return keys.get(obj);
};

function nameOf(obj) {
  if (obj instanceof Textbox) return obj.text.trim().split("\n")[0].slice(0, 32) || "Empty text";
  if (obj instanceof FabricImage) return "Picture";
  if (obj instanceof Group) return "Graphic";
  if (obj instanceof Circle) return "Circle";
  if (obj instanceof Triangle) return "Triangle";
  if (obj instanceof Line) return "Line";
  if (obj instanceof Rect) return "Rectangle";
  return "Element";
}

function Preview({ obj }) {
  if (obj instanceof FabricImage) return <img src={obj.getSrc()} alt="" draggable={false} />;
  if (obj instanceof Textbox) return <Icon name="text" size={15} />;
  if (obj instanceof Group) return <Icon name="elements" size={15} />;
  const color = typeof obj.fill === "string" && obj.fill ? obj.fill : obj.stroke;
  return <i style={{ background: typeof color === "string" ? color : "#8d939b" }} />;
}

// objects: top first. onMove(from, to) use positions in that list.
function LayersPanel({ objects, active, isLocked, onSelect, onMove, onToggleHidden, onToggleLock }) {
  const [dragFrom, setDragFrom] = useState(null);
  const [dropAt, setDropAt] = useState(null);

  if (!objects.length) return <p className="cp-layers-empty">Elements you add will be listed here.</p>;

  const endDrag = () => {
    setDragFrom(null);
    setDropAt(null);
  };

  const selected = (obj) => active === obj || (active?.isType?.("ActiveSelection") && active.getObjects().includes(obj));

  return (
    <ul className="cp-layers">
      {objects.map((obj, i) => {
        const locked = isLocked(obj);
        const hidden = !obj.visible;
        const lands = dropAt === i && dragFrom !== null && dragFrom !== i;
        const classes = [
          selected(obj) ? "is-selected" : "",
          hidden ? "is-hidden" : "",
          lands ? (dragFrom < i ? "drop-below" : "drop-above") : "",
        ].join(" ");
        return (
          <li
            key={keyOf(obj)}
            className={classes}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              setDragFrom(i);
            }}
            onDragOver={(e) => {
              if (dragFrom === null) return;
              e.preventDefault();
              setDropAt(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i);
              endDrag();
            }}
            onDragEnd={endDrag}
          >
            <button className="cp-layer-main" onClick={() => onSelect(obj)} disabled={hidden}>
              <span className="cp-layer-preview"><Preview obj={obj} /></span>
              <span className="cp-layer-name">{nameOf(obj)}</span>
            </button>
            <button
              className={locked ? "on" : ""}
              onClick={() => onToggleLock(obj)}
              title={locked ? "Unlock" : "Lock"}
              aria-label={`${locked ? "Unlock" : "Lock"} ${nameOf(obj)}`}
            >
              <Icon name={locked ? "lock" : "unlock"} size={15} />
            </button>
            <button
              className={hidden ? "on" : ""}
              onClick={() => onToggleHidden(obj)}
              title={hidden ? "Show" : "Hide"}
              aria-label={`${hidden ? "Show" : "Hide"} ${nameOf(obj)}`}
            >
              <Icon name={hidden ? "eyeOff" : "eye"} size={15} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default LayersPanel;
