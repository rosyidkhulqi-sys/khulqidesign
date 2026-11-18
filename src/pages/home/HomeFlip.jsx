// The Templates card on Home: the best template still, then the others
// fading in turn while the pointer is on it, like the Footage card's clips.
// The other pictures load only on the first hover.
import { useEffect, useState } from "react";

const EACH_MS = 1600;

function HomeFlip({ images }) {
  const [on, setOn] = useState(false);
  const [seen, setSeen] = useState(false); // load the rest once hovered
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), EACH_MS);
    return () => clearInterval(timer);
  }, [on, images.length]);

  return (
    <span
      className={`home-flip ${on ? "is-on" : ""}`}
      onPointerEnter={() => {
        setSeen(true);
        setOn(true);
        setIndex(1);
      }}
      onPointerLeave={() => {
        setOn(false);
        setIndex(0);
      }}
    >
      {images.map((src, i) =>
        i === 0 || seen ? <img key={src} src={src} alt="" loading="lazy" className={i === index ? "is-current" : ""} /> : null
      )}
      {on && (
        <span className="home-reel-dots" aria-hidden="true">
          {images.map((src, i) => <i key={src} className={i === index ? "is-current" : ""} />)}
        </span>
      )}
    </span>
  );
}

export default HomeFlip;
