// A masonry grid that fills row by row, as Freepik and Adobe Stock do: each
// card goes into the shortest column so far, so every column fills evenly
// left to right. (CSS columns fill one column top to bottom before the next,
// so a short list leaves the last columns empty and reads downward.)
// Heights come from each item's known shape, so nothing jumps while the
// pictures load.
import { useEffect, useRef, useState } from "react";

// the same breakpoints the CSS grid used: up to 4 columns of at least 240 px,
// 2 on phones
function columnsFor(width) {
  if (width <= 0) return 4;
  if (window.matchMedia("(max-width: 640px)").matches) return 2;
  return Math.max(1, Math.min(4, Math.floor((width + 16) / (240 + 16))));
}

// items: the list; ratio(item): height / width; children(item): the card
function MasonryColumns({ items, ratio, className = "", children }) {
  const ref = useRef(null);
  const [count, setCount] = useState(4);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setCount(columnsFor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columns = Array.from({ length: count }, () => ({ height: 0, items: [] }));
  for (const item of items) {
    const shortest = columns.reduce((a, b) => (b.height < a.height ? b : a));
    shortest.items.push(item);
    shortest.height += ratio(item) || 1;
  }

  return (
    <div ref={ref} className={`${className} is-masonry`}>
      {columns.map((column, i) => (
        <div className="masonry-column" key={i}>
          {column.items.map(children)}
        </div>
      ))}
    </div>
  );
}

export default MasonryColumns;
