// The dock's Mockup section: the mockup editor for a mockup on the page (its
// design areas and the way back into the Studio); otherwise buttons that put
// the page or the selection on a mockup picked in Elements, on the left. A design's text or logo is edited where it was made,
// then put on again, as a smart object's contents are in Photoshop.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import Icon from "../CreateIcons";

export default function MockupSection({ ed }) {
  const { sectionClass, active, openMockup, showMockups } = ed;
  const mockup = active?.kdMockup;
  // no mockup selected: put the page (a template, a new page) or the
  // selection on one, picked in Elements on the left
  if (!mockup) {
    return (
      <div className={sectionClass("mockup")}>
        <p className="cp-label">Mockup</p>
        <button type="button" className="pp-resize" onClick={() => showMockups(true)}>
          <Icon name="dockMockup" size={14} /> Put this page on a mockup
        </button>
        {active && (
          <button type="button" className="pp-resize" onClick={() => showMockups(false)}>
            <Icon name="dockMockup" size={14} /> Put the selection on a mockup
          </button>
        )}
        <p className="cp-hint">Pick a mockup on the left and your design is already on it. Select a mockup on the page to edit it here.</p>
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
