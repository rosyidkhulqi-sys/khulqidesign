// A photo's light and color (a frame's photo for a frame); More holds the
// Premium settings.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import CreateAdjust from "../CreateAdjust";
import { applyAdjust } from "../photoAdjust";

export default function AdjustSection({ ed }) {
  const { sectionClass, active, adjustImage, canPremium, render } = ed;
  return (
    <>
      {/* Adjust: a photo's light and color (the frame's photo for a
          frame); More holds the Premium ones */}
      {adjustImage && (
        <div className={sectionClass("adjust")}>
          <p className="cp-label">Adjust</p>
          <CreateAdjust
            adjust={adjustImage.kdAdjust || {}}
            premium={canPremium}
            onChange={(next) => {
              applyAdjust(adjustImage, next);
              if (active !== adjustImage) active.set("dirty", true);
              render();
            }}
          />
        </div>
      )}
    </>
  );
}
