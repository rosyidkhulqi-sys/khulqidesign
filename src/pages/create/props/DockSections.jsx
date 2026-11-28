// The right dock's properties panel: one section per dock icon, shown one
// at a time by sectionClass (phones show them all).
import MockupSection from "./MockupSection";
import ShapeSection from "./ShapeSection";
import AdjustSection from "./AdjustSection";
import TextSection from "./TextSection";
import ColorSection from "./ColorSection";
import AlignSection from "./AlignSection";
import PositionSection from "./PositionSection";
import EffectsSection from "./EffectsSection";
import AnimateSection from "./AnimateSection";

export default function DockSections({ ed }) {
  return (
    <>
      <MockupSection ed={ed} />
      <ShapeSection ed={ed} />
      <AdjustSection ed={ed} />
      <TextSection ed={ed} />
      <ColorSection ed={ed} />
      <AlignSection ed={ed} />
      <PositionSection ed={ed} />
      <EffectsSection ed={ed} />
      <AnimateSection ed={ed} />
    </>
  );
}
