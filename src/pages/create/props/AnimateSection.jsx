// An entrance and a loop; choosing one plays it.
// Part of the right dock's properties panel; ed is the editor's state and
// actions, handed down by Create.
import CreateAnimate from "../CreateAnimatePanel";

export default function AnimateSection({ ed }) {
  const { sectionClass, active, animOf, playing, setAnim, stopPlay, play } = ed;
  return (
    <>
      {/* Animate: an entrance and a loop, each one row of chips;
          choosing one plays it, Preview plays the whole page */}
      <div className={sectionClass("animate")}>
      <CreateAnimate
        anim={animOf(active)}
        playing={playing}
        onPick={setAnim}
        onPlay={() => (playing ? stopPlay.current?.() : play())}
      />
      </div>
    </>
  );
}
