// The Animate section of the inspector: In and Loop as small tiles, each
// with a line picture of its motion that plays when the pointer is over it,
// so the choice is clear without reading. Choosing one plays it on the page.
import Icon from "./CreateIcons";
import { ENTRANCES, LOOPS } from "./createAnimate";

// one picture per motion: a block, with ghosts or marks for the movement
const box = (x, y, extra = {}) => <rect className="at-box" x={x} y={y} width="12" height="12" rx="2.5" {...extra} />;
const ghost = (x, y, o) => <rect x={x} y={y} width="12" height="12" rx="2.5" fill="currentColor" opacity={o} />;

const PICTURES = {
  none: <><circle cx="20" cy="14" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" /><path d="M15 19l10-10" stroke="currentColor" strokeWidth="1.4" opacity="0.55" /></>,
  rise: <>{ghost(14, 15, 0.18)}{ghost(14, 12, 0.32)}{box(14, 8)}<path d="M31 18V9m-3 3l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>,
  pan: <>{ghost(8, 6, 0.18)}{ghost(12, 6, 0.32)}{box(16, 6)}<path d="M10 23h17m-3-3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>,
  fade: <>{ghost(10, 8, 0.2)}{ghost(14, 8, 0.45)}{box(18, 8)}</>,
  pop: <>{box(14, 8)}<path d="M10 10q-2 4 0 8M30 10q2 4 0 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" /></>,
  wipe: <>{ghost(14, 8, 0.2)}<rect className="at-box at-wipe" x="14" y="8" width="7" height="12" rx="2.5" /><path d="M21 6v16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
  blur: <rect className="at-box at-soft" x="14" y="8" width="12" height="12" rx="3" />,
  pulse: <><circle cx="20" cy="14" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.3" /><circle className="at-box" cx="20" cy="14" r="5.5" /></>,
  rotate: <><rect className="at-box" x="14" y="8" width="12" height="12" rx="2.5" /><path d="M9 11a11 11 0 0 1 6-6m16 12a11 11 0 0 1-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" /></>,
  wiggle: <><rect className="at-box" x="14" y="8" width="12" height="12" rx="2.5" /><path d="M8 9q1.5-1.5 3 0t3 0M26 21q1.5-1.5 3 0t3 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" /></>,
};

function Tile({ value, name, on, onPick }) {
  return (
    <button role="radio" aria-checked={on} className={`at-tile at-${value || "none"} ${on ? "on" : ""}`} onClick={onPick}>
      <svg viewBox="0 0 40 28" aria-hidden="true">{PICTURES[value || "none"]}</svg>
      <span>{name}</span>
    </button>
  );
}

export default function CreateAnimate({ anim, playing, onPick, onPlay }) {
  return (
    <details className="pp-more pp-anim" open={Boolean(anim)}>
      <summary>Animate</summary>
      {[["in", "In", ENTRANCES], ["loop", "Loop", LOOPS]].map(([kind, label, list]) => (
        <div key={kind}>
          <p className="at-label">{label}</p>
          <div className="at-grid" role="radiogroup" aria-label={label}>
            {[["", "None"], ...list].map(([value, name]) => (
              <Tile key={value || "none"} value={value} name={name} on={(anim?.[kind] ?? "") === value} onPick={() => onPick(kind, value)} />
            ))}
          </div>
        </div>
      ))}
      <button className="pp-play" onClick={onPlay}>
        <Icon name={playing ? "stop" : "play"} size={14} /> {playing ? "Stop" : "Preview page"}
      </button>
    </details>
  );
}
