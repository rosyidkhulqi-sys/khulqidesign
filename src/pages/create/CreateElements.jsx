// The Elements tab of the Create editor, laid out like Canva and MiriCanvas:
// a search box, then sections that scroll down, each with "See all".
//   Shapes   drawn by the editor
//   <folder> single SVG/PNG elements from public/trial-elements/<folder>/
//            and the ones uploaded on /admin, by category
//   Icons    basic everyday icons first, then the Khulqidesign icon sets
// Searching happens in CreateSearch, one box for the whole library.
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./CreateIcons";
import { basicIcons } from "./basicIcons";
import { shapes, svgDataUrl } from "./createLibrary";
import { clearRecent as forgetRecent, loadRecent, saveRecent, withRecent } from "./createRecent";
import { elementCategories, elements as trialElements } from "../../data/elementsData";
import { iconSets, membersOf } from "../../data/iconsData";

const setGroups = iconSets.map((set) => ({ set, icons: membersOf(set) }));
const setIcons = setGroups.flatMap((g) => g.icons);
const iconCount = basicIcons.length + setIcons.length;

// how many tiles a "See all" grid adds each time the list scrolls to its end
const PAGE = 60;

// from this many element categories, the overview shows Browse categories
const BROWSE_FROM = 6;

const label = (id) => id.charAt(0).toUpperCase() + id.slice(1);

// the trial folders plus the uploaded parts, newest uploads first
function mergeCategories(uploaded) {
  const merged = new Map(elementCategories.map((c) => [c.id, { ...c, items: [...c.items] }]));
  [...uploaded].reverse().forEach((el) => {
    const category = merged.get(el.category);
    if (category) category.items.unshift(el);
    else merged.set(el.category, { id: el.category, name: label(el.category), items: [el], cover: el.thumb });
  });
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
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
  return (
    <button className="cp-tile" {...dragItem("shape", shape.id)} title={shape.label}>
      <span className={`shape-${shape.id}`} />
    </button>
  );
}

function ShapeTiles({ list, dragItem }) {
  return (
    <div className="cp-grid three">
      {list.map((s) => <ShapeTile key={s.id} shape={s} dragItem={dragItem} />)}
    </div>
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
      <div className={`cp-grid ${columns}`}>{items.slice(0, count).map(renderTile)}</div>
      {count < items.length && <div ref={end} className="cp-more" aria-hidden="true" />}
    </>
  );
}

/* ---------- recently used ---------- */

// a stored { kind, id } back as its tile, or null if the item is gone
// (an element file removed from the folder, for example)
function recentTile({ kind, id }, dragItem, elements) {
  const key = `${kind}:${id}`;
  if (kind === "shape") {
    const s = shapes.find((x) => x.id === id);
    return s && (
      <button key={key} className="cp-tile" {...dragItem("shape", id)} title={s.label}>
        <span className={`shape-${id}`} />
      </button>
    );
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
    const icon = setIcons.find((x) => x.id === id);
    return icon && <SetIconTile key={key} icon={icon} dragItem={dragItem} />;
  }
  return null;
}

/* ---------- panel ---------- */

function ElementsPanel({ dragItem: placeItem, uploaded = [] }) {
  const elements = useMemo(() => [...uploaded, ...trialElements], [uploaded]);
  const categories = useMemo(() => mergeCategories(uploaded), [uploaded]);
  const browse = categories.length >= BROWSE_FROM;
  // the section open in full ("See all"): a category id, "icons", "recent" or null
  const [view, setView] = useState(null);
  const [recent, setRecent] = useState(loadRecent);

  const remember = (kind, id) => setRecent(saveRecent(kind, id));

  // empties the recently used list and goes back to the overview
  const clearRecent = () => {
    if (!window.confirm("Clear recently used elements?")) return;
    setRecent([]);
    setView(null);
    forgetRecent();
  };

  const dragItem = withRecent(placeItem, remember);

  const recentTiles = recent.map((r) => recentTile(r, dragItem, elements)).filter(Boolean);

  const elementTile = (el) => <ElementTile key={el.id} el={el} dragItem={dragItem} />;

  /* one section in full */
  if (view) {
    const category = categories.find((c) => c.id === view);
    return (
      <>
        <button className="cp-back" onClick={() => setView(null)}>
          <Icon name="arrowLeft" size={16} />
          {category ? category.name : view === "recent" ? "Recently used" : "Icons"}
        </button>

        {category && <PagedGrid items={category.items} renderTile={elementTile} />}

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

  /* overview: sections that scroll down, a short row each */
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

      <SectionHead title="Shapes" />
      <ShapeTiles list={shapes} dragItem={dragItem} />

      {/* many categories: one grid of picture tiles, as Canva's Browse
          categories; few: a short row for each */}
      {browse ? (
        <>
          <SectionHead title="Browse categories" />
          <div className="cp-grid three">
            {categories.map((c) => (
              <CategoryTile
                key={c.id}
                name={c.name}
                count={c.items.length}
                picture={c.cover}
                onOpen={() => setView(c.id)}
              />
            ))}
            <CategoryTile
              name="Icons"
              count={iconCount}
              picture={svgDataUrl(basicIcons.find((i) => i.id === "star").svg)}
              onOpen={() => setView("icons")}
            />
          </div>
        </>
      ) : (
        categories.map((c) => (
          <div key={c.id}>
            <SectionHead title={c.name} count={c.items.length} onAll={() => setView(c.id)} />
            <div className="cp-grid three">{c.items.slice(0, 6).map(elementTile)}</div>
          </div>
        ))
      )}

      {/* a note for the developer only, while the folder is empty */}
      {import.meta.env.DEV && elements.length === 0 && (
        <p className="cp-hint">
          Add SVG or PNG files to public/trial-elements/&lt;category&gt;/ and they appear here.
        </p>
      )}

      {/* with the category grid, Icons is one of its tiles */}
      {!browse && (
        <>
          <SectionHead title="Icons" count={iconCount} onAll={() => setView("icons")} />
          <div className="cp-grid three">
            {basicIcons.slice(0, 6).map((i) => <BasicTile key={i.id} icon={i} dragItem={dragItem} />)}
          </div>
        </>
      )}

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
