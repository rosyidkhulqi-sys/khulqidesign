// Grey shimmering cards in place of a library's grid while it loads, so the
// page shows its shape at once instead of an empty space or a loading line.
// Put it inside the page's own grid and give it the page's card class, so the
// columns and spacing are exactly the same as the real cards.
//   count: how many; ratios: picture shapes, used in turn ("4 / 3");
//   cardClass: the page's card class; caption: a title line under each

function SkeletonCards({ count = 12, ratios = ["1 / 1"], cardClass = "", caption = true }) {
  return (
    <>
      <span className="sr-only" role="status">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${cardClass} skel-card`} aria-hidden="true">
          <div className="skel" style={{ aspectRatio: ratios[i % ratios.length] }} />
          {caption && <div className="skel skel-line" style={{ width: `${55 + ((i * 17) % 35)}%` }} />}
        </div>
      ))}
    </>
  );
}

export default SkeletonCards;
