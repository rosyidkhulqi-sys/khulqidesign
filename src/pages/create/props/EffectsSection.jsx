// Shadow, opacity and blend mode, as Illustrator's Transparency panel; a
// frame keeps its own shadow in the Frame section.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import Icon from "../CreateIcons";
import NumberInput from "../../../components/NumberInput";

export default function EffectsSection({ ed }) {
  const { sectionClass, active, isSelection, shadowAmount, setShadow, setOpacity, setBlend } = ed;
  return (
    <>
      {/* Effects: shadow, opacity and how it blends with what's under
          it, as Illustrator's Transparency panel; a frame keeps its
          own shadow in the Frame section */}
      <div className={sectionClass("effects")}>
        <p className="cp-label">Effects</p>
        {!active.kdFrame && (
          <div className="pp-type">
            <label title="Shadow (0 to 100)">
              <Icon name="shadow" size={16} />
              <NumberInput
                min="0"
                max="100"
                step="5"
                value={shadowAmount(isSelection ? active.getObjects()[0] : active)}
                onChange={(e) => setShadow(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                aria-label="Shadow"
              />
            </label>
          </div>
        )}
        <label className="pp-row">
          <span>Opacity</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round((isSelection ? active.getObjects()[0]?.opacity ?? 1 : active.opacity) * 100)}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
          />
        </label>
        <label className="pp-row">
          <span>Blend</span>
          <select
            className="pp-select"
            value={(isSelection ? active.getObjects()[0]?.globalCompositeOperation : active.globalCompositeOperation) || "source-over"}
            onChange={(e) => setBlend(e.target.value)}
            aria-label="Blend mode"
          >
            {[
              ["source-over", "Normal"],
              ["multiply", "Multiply"],
              ["screen", "Screen"],
              ["overlay", "Overlay"],
              ["darken", "Darken"],
              ["lighten", "Lighten"],
            ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}
