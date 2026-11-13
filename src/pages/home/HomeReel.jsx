// The Footage card on Home: its cover until hovered, then a few clips from
// the store in turn, a few seconds each. Nothing loads before the hover, and
// on data saver or a very slow connection the cover stays still.
import { useEffect, useRef, useState } from "react";

const EACH_MS = 3000;

const slow = () => {
  const c = navigator.connection;
  return Boolean(c && (c.saveData || ["slow-2g", "2g"].includes(c.effectiveType)));
};

function HomeReel({ cover, clips }) {
  const [on, setOn] = useState(false);
  const [index, setIndex] = useState(0);
  const video = useRef(null);

  // the next clip every few seconds while the pointer stays
  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % clips.length), EACH_MS);
    return () => clearInterval(timer);
  }, [on, clips.length]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (on) v.play().catch(() => {});
    else v.pause();
  }, [on, index]);

  return (
    <span
      className={`home-reel ${on ? "is-on" : ""}`}
      onPointerEnter={() => !slow() && setOn(true)}
      onPointerLeave={() => {
        setOn(false);
        setIndex(0);
      }}
    >
      <img src={cover} alt="" loading="lazy" />
      {on && (
        <video key={clips[index]} ref={video} src={clips[index]} muted playsInline autoPlay preload="auto" />
      )}
      {on && (
        <span className="home-reel-dots" aria-hidden="true">
          {clips.map((c, i) => <i key={c} className={i === index ? "is-current" : ""} />)}
        </span>
      )}
    </span>
  );
}

export default HomeReel;
