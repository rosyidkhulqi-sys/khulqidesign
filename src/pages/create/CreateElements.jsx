// Create's Elements tab groups insertable assets into browsable categories.
// Shapes and basic icons stay built in; uploaded graphics, grids, frames and
// photos come from the same published asset catalog used by Admin.
// The existing Icons catalog is reused here, without copying its records.
// Searching happens in CreateSearch, one box for the whole library.
import { useEffect, useMemo, useRef, useState } from "react";
import { askConfirm } from "../../lib/confirm";
import Icon from "./CreateIcons";
import { basicIcons } from "./basicIcons";
import { shapeGroups, shapes, svgDataUrl } from "./createLibrary";
import { clearRecent as forgetRecent, loadRecent, saveRecent, withRecent } from "./createRecent";
import { elementCategories, elements as trialElements } from "../../data/elementsData";
import { elementCategoryLabel, normalizeElementCategory } from "../../data/elementCategories";
import { fetchIconCatalog } from "../../lib/catalog";

// how many tiles a category grid adds each time the list scrolls to its end
const PAGE = 60;
const SHAPES_PREVIEW = svgDataUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect x="12" y="18" width="28" height="28" fill="#000000"/><circle cx="67" cy="32" r="15" fill="#000000"/><path d="M28 78l18-28 18 28z" fill="#000000"/></svg>'
);

// the trial assets plus the uploaded parts, newest uploads first
function mergeCategories(uploaded) {
  const merged = new Map(elementCategories.map((c) => [c.id, { ...c, items: [...c.items] }]));
  [...uploaded].reverse().forEach((el) => {
    const id = normalizeElementCategory(el.category);
    const category = merged.get(id);
    if (category) category.items.unshift(el);
    else merged.set(id, { id, name: elementCategoryLabel(id), items: [el], cover: el.thumb });
  });
  return [...merged.values()].map((category) => ({
    ...category,
    name: elementCategoryLabel(category.id),
  }));
}

function SectionHead({ title, count, onAll }) {
  return (
    <div className="cp-head">
      <p className="cp-label">{title}</p>
      {onAll && (
        <button className="cp-all" onClick={onAll}>
          See all{count ? ` (${count})` : ""}
        </button>
      )}
    </div>
  );
}

/* ---------- tiles ---------- */

export function ShapeTile({ shape, dragItem }) {
  const preview = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${shape.preview}</svg>`);
  return (
    <button className="cp-tile" {...dragItem("shape", shape.id)} title={shape.label}>
      <img src={preview} alt="" draggable={false} />
    </button>
  );
}

function ShapeTiles({ list, dragItem }) {
  return (
    <>
      {shapeGroups.map((group) => (
        <section className="cp-shape-set" key={group.id}>
          <SectionHead title={group.name} count={group.items.length} />
          <div className="cp-grid three">
            {group.items.map((shape) => <ShapeTile key={shape.id} shape={shape} dragItem={dragItem} />)}
          </div>
        </section>
      ))}
      {list.length > 0 && (
        <section className="cp-shape-set">
          <SectionHead title="Uploaded shapes" count={list.length} />
          <PagedGrid items={list} renderTile={(el) => <ElementTile key={el.id} el={el} dragItem={dragItem} />} />
        </section>
      )}
    </>
  );
}

export function ElementTile({ el, dragItem }) {
  return (
    <button className="cp-tile" {...dragItem("element", el.id)} title={el.name}>
      {/* crossOrigin: the same CDN file is read again when it's placed */}
      <img src={el.thumb ?? el.url} alt={el.name} draggable={false} loading="lazy" crossOrigin="anonymous" />
    </button>
  );
}

export function BasicTile({ icon, dragItem }) {
  return (
    <button className="cp-tile" {...dragItem("basic", icon.id)} title={icon.name}>
      <img src={svgDataUrl(icon.svg)} alt={icon.name} draggable={false} />
    </button>
  );
}

export function SetIconTile({ icon, dragItem }) {
  return (
    <button className="cp-tile" {...dragItem("icon", icon.id)} title={icon.name}>
      <img src={icon.image} alt={icon.name} draggable={false} loading="lazy" crossOrigin="anonymous" />
    </button>
  );
}

// a category in Browse categories: its picture, name and count
function CategoryTile({ name, count, picture, onOpen }) {
  return (
    <button className="cp-cat" onClick={onOpen} title={`${name} (${count})`}>
      <span className="cp-cat-pic">
        <img src={picture} alt="" draggable={false} loading="lazy" crossOrigin="anonymous" />
      </span>
      <span className="cp-cat-name">{name}</span>
    </button>
  );
}

// A long grid that renders PAGE tiles at a time, adding more as it scrolls
// into view, so a category with thousands of elements stays light.
export function PagedGrid({ items, renderTile, columns = "three" }) {
  const [count, setCount] = useState(PAGE);
  const end = useRef(null);

  useEffect(() => {
    const node = end.current;
    if (!node) return;
    const watch = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setCount((c) => c + PAGE);
    });
    watch.observe(node);
    return () => watch.disconnect();
  }, [items]);

  return (
    <>
      <div className={columns === "masonry" ? "cp-masonry" : `cp-grid ${columns}`}>{items.slice(0, count).map(renderTile)}</div>
      {count < items.length && <div ref={end} className="cp-more" aria-hidden="true" />}
    </>
  );
}

/* ---------- recently used ---------- */

// a stored { kind, id } back as its tile, or null if the item is gone
// (an element file removed from the folder, for example)
function recentTile({ kind, id }, dragItem, elements, icons) {
  const key = `${kind}:${id}`;
  if (kind === "shape") {
    const s = shapes.find((x) => x.id === id);
    return s && <ShapeTile key={key} shape={s} dragItem={dragItem} />;
  }
  if (kind === "element") {
    const el = elements.find((x) => x.id === id);
    return el && <ElementTile key={key} el={el} dragItem={dragItem} />;
  }
  if (kind === "basic") {
    const icon = basicIcons.find((x) => x.id === id);
    return icon && <BasicTile key={key} icon={icon} dragItem={dragItem} />;
  }
  if (kind === "icon") {
    const icon = icons.find((x) => x.id === id);
    return icon && <SetIconTile key={key} icon={icon} dragItem={dragItem} />;
  }
  return null;
}

/* ---------- panel ---------- */

function ElementsPanel({ dragItem: placeItem, uploaded = [] }) {
  const elements = useMemo(() => [...uploaded, ...trialElements], [uploaded]);
  const categories = useMemo(() => mergeCategories(uploaded), [uploaded]);
  const [iconCatalog, setIconCatalog] = useState({ icons: [], sets: [] });
  useEffect(() => {
    let alive = true;
    fetchIconCatalog()
      .then((catalog) => alive && setIconCatalog({
        icons: catalog.icons.map((icon) => ({ ...icon, id: icon.code })),
        sets: catalog.sets,
      }))
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const setIcons = iconCatalog.icons;
  const setGroups = useMemo(() => iconCatalog.sets.map((set) => ({
    set,
    icons: setIcons.filter((icon) => icon.setId === set.id),
  })).filter((group) => group.icons.length > 0), [iconCatalog.sets, setIcons]);
  const iconCount = basicIcons.length + setIcons.length;
  const shapeCategory = categories.find((c) => c.id === "shapes");
  const browsableCategories = categories.filter((c) => c.id !== "shapes" && c.items.length > 0);
  // the open category, the existing icon catalog, built-in shapes, or recent items
  const [view, setView] = useState(null);
  const browseTiles = [
    ...browsableCategories.filter((c) => c.id === "graphics" || c.id === "grids").map((c) => ({
      ...c,
      picture: c.cover,
      onOpen: () => setView(c.id),
    })),
    {
      id: "icons",
      name: "Icons",
      count: iconCount,
      picture: svgDataUrl(basicIcons.find((i) => i.id === "star").svg),
      onOpen: () => setView("icons"),
    },
    {
      id: "shapes",
      name: "Shapes",
      count: shapes.length + (shapeCategory?.items.length ?? 0),
      picture: shapeCategory?.cover ?? SHAPES_PREVIEW,
      onOpen: () => setView("shapes"),
    },
    ...browsableCategories.filter((c) => c.id === "frames" || c.id === "photos").map((c) => ({
      ...c,
      picture: c.cover,
      onOpen: () => setView(c.id),
    })),
    ...browsableCategories
      .filter((c) => !["graphics", "grids", "frames", "photos"].includes(c.id))
      .map((c) => ({ ...c, picture: c.cover, onOpen: () => setView(c.id) })),
  ];
  const [recent, setRecent] = useState(loadRecent);

  const remember = (kind, id) => setRecent(saveRecent(kind, id));

  // empties the recently used list and goes back to the overview
  const clearRecent = async () => {
    const sure = await askConfirm({ title: "Clear recently used elements?", confirmLabel: "Clear" });
    if (!sure) return;
    setRecent([]);
    setView(null);
    forgetRecent();
  };

  const dragItem = withRecent(placeItem, remember);

  const recentTiles = recent.map((r) => recentTile(r, dragItem, elements, setIcons)).filter(Boolean);

  const elementTile = (el) => <ElementTile key={el.id} el={el} dragItem={dragItem} />;

  /* one section in full */
  if (view) {
    const category = categories.find((c) => c.id === view);
    return (
      <>
        <button className="cp-back" onClick={() => setView(null)}>
          <Icon name="arrowLeft" size={16} />
          {category?.name ?? (view === "recent" ? "Recently used" : view === "shapes" ? "Shapes" : "Icons")}
        </button>

        {category && view !== "shapes" && <PagedGrid items={category.items} renderTile={elementTile} />}

        {view === "shapes" && <ShapeTiles list={shapeCategory?.items ?? []} dragItem={dragItem} />}

        {view === "recent" && (
          <>
            <div className="cp-grid three">{recentTiles}</div>
            <button className="cp-clear" onClick={clearRecent}>
              <Icon name="trash" size={14} /> Clear recently used
            </button>
          </>
        )}

        {view === "icons" && (
          <>
            <div className="cp-set">
              <p className="cp-label">
                Basic <span>{basicIcons.length}</span>
              </p>
              <div className="cp-grid three">
                {basicIcons.map((i) => <BasicTile key={i.id} icon={i} dragItem={dragItem} />)}
              </div>
            </div>

            {/* icon sets keep one style, so a design can stay consistent */}
            {setGroups.map(({ set, icons }) => (
              <div key={set.id} className="cp-set">
                <p className="cp-label">
                  {set.name}
                  <span>
                    {icons.length} · {set.style}
                  </span>
                </p>
                <div className="cp-grid three">
                  {icons.map((i) => <SetIconTile key={i.id} icon={i} dragItem={dragItem} />)}
                </div>
              </div>
            ))}
          </>
        )}
      </>
    );
  }

  /* overview: recent items and the categories available in this account */
  return (
    <>
      {/* the last things used, newest first; hidden until there are some */}
      {recentTiles.length > 0 && (
        <>
          {/* "See all" is always there, as it also holds Clear */}
          <SectionHead
            title="Recently used"
            count={recentTiles.length}
            onAll={() => setView("recent")}
          />
          <div className="cp-grid three">{recentTiles.slice(0, 6)}</div>
        </>
      )}

      <SectionHead title="Browse categories" />
      <div className="cp-grid three">
        {browseTiles.map((category) => (
          <CategoryTile
            key={category.id}
            name={category.name}
            count={category.count}
            picture={category.picture}
            onOpen={category.onOpen}
          />
        ))}
      </div>

      <p className="cp-hint">Click or drag onto the page. SVG elements and icons can be recolored.</p>
    </>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search elements" }) {
  return (
    <label className="cp-search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default ElementsPanel;
