// The dock's Mockup section, always there under Animate as the ecosystem's
// tool. For a mockup on the page: its design areas and the way back into
// the Studio. Otherwise: "Put on a mockup" — the selected element (a logo)
// or the open page goes onto every design area of the mockup picked, in one
// click. A design's text or logo is edited where it was made, then put on
// again, as a smart object's contents are in Photoshop.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import Icon from "../CreateIcons";
import MockupTiles from "../mockup/MockupTiles";
import useMockups from "../mockup/useMockups";

function PutOnMockup({ ed }) {
  const { active, putOnMockup } = ed;
  const mockups = useMockups();
  return (
    <>
      <p className="cp-hint">
        {active ? "The selected element goes on every design area of the mockup you pick." : "This page goes on every design area of the mockup you pick, without its background."}
      </p>
      <MockupTiles mockups={mockups} onOpen={(m) => putOnMockup(m)} />
    </>
  );
}

export default function MockupSection({ ed }) {
  const { sectionClass, active, openMockup } = ed;
  const mockup = active?.kdMockup;
  if (!mockup) {
    return (
      <div className={sectionClass("mockup")}>
        <p className="cp-label">Put on a mockup</p>
        <PutOnMockup ed={ed} />
      </div>
    );
  }
  const areas = mockup.areas ?? [];
  return (
    <div className={sectionClass("mockup")}>
      <p className="cp-label">Mockup</p>
      <p className="pp-mockup-title">{mockup.title}</p>
      {areas.length > 0 && (
        <ul className="pp-mockup-areas">
          {areas.map((name, n) => (
            <li key={name}>
              <span>{name}</span>
              <span className={mockup.designs?.[n] ? "on" : ""}>{mockup.designs?.[n] ? "Your design" : "Sample"}</span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="pp-resize" onClick={() => openMockup(mockup, active)}>
        <Icon name="dockMockup" size={14} /> Edit in Studio
      </button>
      <p className="cp-hint">To change a text or logo, edit the page you used, then pick it again in the Studio. Double-clicking the mockup opens the Studio too.</p>
    </div>
  );
}
