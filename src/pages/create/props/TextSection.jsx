// A text's section: the words, font, size, line and letter spacing, style,
// alignment and case, as Illustrator's Character panel.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import FontPicker from "../FontPicker";
import Icon from "../CreateIcons";
import NumberInput from "../../../components/NumberInput";
import { loadFont } from "../createFonts";

export default function TextSection({ ed }) {
  const { sectionClass, active, setProp, isText, setCase } = ed;
  return (
    <>
      {isText && (
        <div className={sectionClass("text")}>
          <p className="cp-label">Text</p>
          <textarea
            className="pp-textarea"
            value={active.text}
            onChange={(e) => setProp({ text: e.target.value })}
          />
          <FontPicker
            value={active.fontFamily}
            onPick={async (fontFamily) => {
              await loadFont(fontFamily);
              setProp({ fontFamily });
            }}
          />
          {/* size, leading, tracking and shadow: icon and number, as in
              Illustrator's Character panel; arrow keys step them */}
          <div className="pp-type">
            <label title="Font size (px)">
              <Icon name="fontSize" size={16} />
              <NumberInput
                min="1"
                value={Math.round(active.fontSize)}
                onChange={(e) => setProp({ fontSize: Math.max(1, Number(e.target.value)) })}
                aria-label="Font size"
              />
            </label>
            <label title="Line spacing (px between lines)">
              <Icon name="leading" size={16} />
              <NumberInput
                min="1"
                value={Math.round(active.fontSize * (active.lineHeight || 1.16) * 1.13)}
                onChange={(e) => {
                  const px = Number(e.target.value);
                  if (px > 0) setProp({ lineHeight: Math.max(0.5, px / (active.fontSize * 1.13)) });
                }}
                aria-label="Line spacing"
              />
            </label>
            <label title="Letter spacing (1/1000 em)">
              <Icon name="tracking" size={16} />
              <NumberInput
                step="10"
                value={active.charSpacing || 0}
                onChange={(e) => setProp({ charSpacing: Number(e.target.value) || 0 })}
                aria-label="Letter spacing"
              />
            </label>
          </div>
          {/* style, alignment and case as small segmented groups, so
              they sit in two short rows */}
          <div className="pp-tools">
          <div className="pp-seg" role="group" aria-label="Text style">
            <button
              title="Bold"
              className={Number(active.fontWeight) >= 600 || active.fontWeight === "bold" ? "on" : ""}
              onClick={() => setProp({ fontWeight: Number(active.fontWeight) >= 600 || active.fontWeight === "bold" ? 400 : 700 })}
            >
              <b>B</b>
            </button>
            <button
              title="Italic"
              className={active.fontStyle === "italic" ? "on" : ""}
              onClick={() => setProp({ fontStyle: active.fontStyle === "italic" ? "normal" : "italic" })}
            >
              <i>I</i>
            </button>
            <button
              title="Underline"
              className={active.underline ? "on" : ""}
              onClick={() => setProp({ underline: !active.underline })}
            >
              <u>U</u>
            </button>
          </div>
          <div className="pp-seg" role="group" aria-label="Text alignment">
            {["left", "center", "right"].map((a) => (
              <button
                key={a}
                className={active.textAlign === a ? "on" : ""}
                onClick={() => setProp({ textAlign: a })}
                title={`Align ${a}`}
              >
                <Icon name={`align${a[0].toUpperCase()}${a.slice(1)}`} size={16} />
              </button>
            ))}
          </div>
          <div className="pp-seg pp-case" role="group" aria-label="Letter case">
            <button onClick={() => setCase("upper")} title="UPPERCASE">AA</button>
            <button onClick={() => setCase("lower")} title="lowercase">aa</button>
            <button onClick={() => setCase("title")} title="Title Case">Aa</button>
          </div>
          </div>
        </div>
      )}
    </>
  );
}
