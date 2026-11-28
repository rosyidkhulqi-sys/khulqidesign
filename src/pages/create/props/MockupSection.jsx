// A mockup on the page: its design areas and the way back into the Mockup
// Studio. Its text or logo is edited where it was made (a page of the design,
// the AI logo maker, an upload), then used in the Studio again, as a smart
// object's contents are in Photoshop.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import Icon from "../CreateIcons";

export default function MockupSection({ ed }) {
  const { sectionClass, active, openMockup } = ed;
  const mockup = active?.kdMockup;
  if (!mockup) return null;
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
