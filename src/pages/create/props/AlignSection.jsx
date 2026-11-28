// Line up with the page, or with each other when several are picked.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import Icon from "../CreateIcons";

export default function AlignSection({ ed }) {
  const { sectionClass, locked, active, isSelection, alignTo, distribute } = ed;
  return (
    <>
      <div className={sectionClass("align")}>
      {/* line up with the page, or with each other when several are picked */}
      <p className="cp-label">{isSelection ? "Align selection" : "Align to page"}</p>
      <div className="pp-align pp-seg" role="group" aria-label="Align">
        {[
          ["center", "objCenter", "Align center, horizontally and vertically"],
          ["left", "objLeft", "Align left"],
          ["centerH", "objCenterH", "Align center"],
          ["right", "objRight", "Align right"],
          ["top", "objTop", "Align top"],
          ["centerV", "objCenterV", "Align middle"],
          ["bottom", "objBottom", "Align bottom"],
        ].map(([edge, icon, label]) => (
          <button key={edge} onClick={() => alignTo(edge)} title={label} aria-label={label} disabled={locked}>
            <Icon name={icon} size={16} />
          </button>
        ))}
      </div>
      {isSelection && active.size() >= 3 && (
        <div className="pp-seg pp-dist" role="group" aria-label="Distribute">
          <button onClick={() => distribute("h")} title="Distribute horizontally" aria-label="Distribute horizontally">
            <Icon name="distH" size={16} />
          </button>
          <button onClick={() => distribute("v")} title="Distribute vertically" aria-label="Distribute vertically">
            <Icon name="distV" size={16} />
          </button>
        </div>
      )}
      </div>
    </>
  );
}
