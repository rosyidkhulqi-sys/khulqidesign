// Size, group, and Arrange: layer order, flips and rotation, each with its
// shortcut in the tooltip.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import Icon from "../CreateIcons";
import NumberInput from "../../../components/NumberInput";
import { MOD } from "../platform";

export default function PositionSection({ ed }) {
  const { sectionClass, active, setProp, render, isText, isSelection, setSize, lockRatio, setLockRatio, isGroup, group, ungroup, arrange } = ed;
  return (
    <>
      <div className={sectionClass("position")}>
      <p className="cp-label">Size</p>
      <div className="pp-pair">
        <label>
          W
          <NumberInput
            className="pp-num"
            value={Math.round(active.getScaledWidth())}
            onChange={(e) => setSize("w", e.target.value)}
          />
        </label>
        {!isText && (
          <label>
            H
            <NumberInput
              className="pp-num"
              value={Math.round(active.getScaledHeight())}
              onChange={(e) => setSize("h", e.target.value)}
            />
          </label>
        )}
        {!isText && (
          <button
            className={`pp-lock ${lockRatio ? "on" : ""}`}
            onClick={() => setLockRatio(!lockRatio)}
            title="Keep proportions"
          >
            <Icon name={lockRatio ? "lock" : "unlock"} size={15} />
          </button>
        )}
      </div>

      {(isSelection || isGroup) && (
        <div className="pp-grid">
          {isSelection && <button onClick={group}><Icon name="group" size={16} /><span>Group</span></button>}
          {isGroup && <button onClick={ungroup}><Icon name="ungroup" size={16} /><span>Ungroup</span></button>}
        </div>
      )}

      {/* layer order, flip and rotation; duplicate, lock and delete
          are on the toolbar by the element */}
      <p className="cp-label">Arrange</p>
      <div className="pp-arrange">
        {/* layer order and flips: an icon and a short name in compact
            rows, so anyone can tell them apart; rotation is a field */}
        <div className="pp-list">
          <button onClick={() => arrange("front")} title={`Bring to front (${MOD} ⇧ ])`}><Icon name="front" size={15} /><span>To front</span></button>
          <button onClick={() => arrange("back")} title={`Send to back (${MOD} ⇧ [)`}><Icon name="back" size={15} /><span>To back</span></button>
          <button onClick={() => arrange("forward")} title={`Bring forward (${MOD} ])`}><Icon name="forward" size={15} /><span>Forward</span></button>
          <button onClick={() => arrange("backward")} title={`Send backward (${MOD} [)`}><Icon name="backward" size={15} /><span>Backward</span></button>
          <button className={active.flipX ? "on" : ""} onClick={() => setProp({ flipX: !active.flipX })} title="Flip horizontal, mirror (⇧ H)">
            <Icon name="flipH" size={15} /><span>Flip H</span>
          </button>
          <button className={active.flipY ? "on" : ""} onClick={() => setProp({ flipY: !active.flipY })} title="Flip vertical, upside down (⇧ V)">
            <Icon name="flipV" size={15} /><span>Flip V</span>
          </button>
        </div>
        <div className="pp-type">
          <label title="Rotation (degrees)">
            <Icon name="rotate" size={16} />
            <NumberInput
              value={Math.round(active.angle)}
              onChange={(e) => {
                active.rotate(Number(e.target.value) || 0);
                active.setCoords();
                render();
              }}
              aria-label="Rotation"
            />
          </label>
        </div>
      </div>
      </div>
    </>
  );
}
