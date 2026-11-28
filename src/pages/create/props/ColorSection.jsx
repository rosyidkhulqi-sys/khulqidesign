// The element's colors; a photo's colors are its pixels, so it has none here.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import CreateColors from "../CreateColors";
import { FabricImage } from "fabric";
import { colorObjectKey } from "../colorTools";

export default function ColorSection({ ed }) {
  const { sectionClass, active, render, pickFromPage, openColorEditor } = ed;
  return (
    <>
      <div className={sectionClass("color")}>
      {/* a photo's colors are its pixels; its fill isn't one of them */}
      {!(active instanceof FabricImage) && <CreateColors
        key={colorObjectKey(active)}
        onPickFromPage={pickFromPage}
        object={active}
        onEdit={(color) => openColorEditor("object", color)}
        onChange={() => {
          active.set("dirty", true);
          render();
        }}
      />}

      </div>
    </>
  );
}
