// The Templates card on Home: the best template still, then the others
// fading in turn while the pointer is on it, like the Footage card's clips.
// The other pictures load once the card scrolls into view, and the card only
// moves on to a picture that has arrived, so the first hover never flashes.
import { useEffect, useRef, useState } from "react";

const EACH_MS = 1600;

function HomeFlip({ images }) {
  const [on, setOn] = useState(false);
  const [near, setNear] = useState(false); // in or near the view: load the rest
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(() => new Set([0])); // pictures loaded
  const box = useRef(null);

  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    const watch = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: "300px" });
    watch.observe(el);
    return () => watch.disconnect();
  }, [near]);

  // the next picture that has loaded, or stay
  const nextReady = (from) => {
    for (let step = 1; step < images.length; step++) {
      const i = (from + step) % images.length;
      if (ready.has(i)) return i;
    }
    return from;
  };

  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => setIndex((i) => nextReady(i)), EACH_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ready]);

  const loaded = (i) => setReady((s) => (s.has(i) ? s : new Set(s).add(i)));

  return (
    <span
      ref={box}
      className={`home-flip ${on ? "is-on" : ""}`}
      onPointerEnter={() => {
        setNear(true);
        setOn(true);
        setIndex((i) => nextReady(i));
      }}
      onPointerLeave={() => {
        setOn(false);
        setIndex(0);
      }}
    >
      {images.map((src, i) =>
        i === 0 || near ? (
          <img
            key={src}
            src={src}
            alt=""
            loading={i === 0 ? "lazy" : "eager"}
            decoding="async"
            onLoad={() => loaded(i)}
            className={i === index ? "is-current" : ""}
          />
        ) : null
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
