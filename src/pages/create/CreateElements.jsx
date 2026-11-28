// Create's Elements tab groups insertable assets into browsable categories.
// Shapes and basic icons stay built in; uploaded graphics, grids, frames and
// photos come from the same published asset catalog used by Admin.
// The existing Icons catalog is reused here, without copying its records.
// Searching happens in CreateSearch, one box for the whole library.
import { useEffect, useMemo, useRef, useState } from "react";
import { askConfirm } from "../../lib/confirm";
import Icon from "./CreateIcons";
import { basicIcons } from "./basicIcons";
import { QrPanel } from "./CreateQr";
import { qrSvg } from "./qrCode";
import { TABLE_STYLES, tableArt } from "./createTable";
import { frameArt, photoFrames, shapeGroups, shapes, svgDataUrl } from "./createLibrary";
import { clearRecent as forgetRecent, loadRecent, saveRecent, withRecent } from "./createRecent";
import { elementCategories, elements as trialElements } from "../../data/elementsData";

// the built-in parts of a category, shown after its uploaded ones
const trialOf = (id) => elementCategories.find((c) => c.id === id)?.items ?? [];
import { ELEMENT_CATEGORIES, elementCategoryLabel, elementCategoryStorageValues, normalizeElementCategory } from "../../data/elementCategories";
import { countCreateCategories, fetchCreatePage, fetchCreatePartsByCode, fetchCreatePhotos, fetchIconCatalog } from "../../lib/catalog";
import MockupTiles from "./mockup/MockupTiles";
import useMockups from "./mockup/useMockups";

// how many tiles a category grid adds each time the list scrolls to its end
const PAGE = 60;
// the QR code tile: a real code for the site's address
const QR_PREVIEW = svgDataUrl(qrSvg("https://khulqidesign.com"));

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

function ShapeTiles({ list, dragItem, uploadedGrid, uploadedCount = 0 }) {
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
      {uploadedGrid ? (
        <section className="cp-shape-set">
          <SectionHead title="Uploaded shapes" count={uploadedCount} />
          {uploadedGrid}
        </section>
      ) : list.length > 0 && (
        <section className="cp-shape-set">
          <SectionHead title="Uploaded shapes" count={list.length} />
          <PagedGrid items={list} renderTile={(el) => <ElementTile key={el.id} el={el} dragItem={dragItem} />} />
        </section>
      )}
    </>
  );
}

export function FrameTile({ frame, dragItem }) {
  return (
    <button className="cp-tile" {...dragItem("frame", frame.id)} title={`${frame.label} photo frame`}>
      <img src={frameArt(frame)} alt="" draggable={false} />
    </button>
  );
}

export function TableTile({ style, label, dragItem }) {
  return (
    <button className="cp-tile" {...dragItem("table", style)} title={`${label} table`}>
      <img src={tableArt(style)} alt="" draggable={false} />
    </button>
  );
}

// the three table styles, with a line on how to type in them
export function TableTiles({ dragItem }) {
  return (
    <>
      <div className="cp-grid three">
        {TABLE_STYLES.map(([style, label]) => <TableTile key={style} style={style} label={label} dragItem={dragItem} />)}
      </div>
      <p className="cp-hint">Add a table, then double-click a cell to type.</p>
    </>
  );
}

// a small crown on a Premium tile: free to try in a design, Premium to download
export function PremiumMark() {
  return (
    <span className="cp-crown" title="Premium: try it in your design, download with Premium">
      <Icon name="crown" size={11} />
    </span>
  );
}

export function ElementTile({ el, dragItem }) {
  return (
    <button className="cp-tile is-element" {...dragItem("element", el.id)} title={el.name}>
      {/* crossOrigin: the same CDN file is read again when it's placed */}
      <img src={el.thumb ?? el.url} alt={el.name} draggable={false} loading="lazy" crossOrigin="anonymous" />
      {el.premium && <PremiumMark />}
    </button>
  );
}

// a photo from the Photos library, on the page as any element: a Premium one
// with its watermark and crown, free to try, downloaded with Premium (as Canva)
export function StockPhotoTile({ photo, dragItem }) {
  return (
    <button className="cp-tile wide" {...dragItem("element", photo.id)} title={photo.name}>
      <img src={photo.thumb} alt={photo.name} draggable={false} loading="lazy" crossOrigin="anonymous" />
      {photo.premium && <PremiumMark />}
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
function CategoryTile({ name, count, picture, onOpen, premium = false }) {
  return (
    <button className="cp-cat" onClick={onOpen} title={`${name} (${count})`}>
      <span className="cp-cat-pic">
        <img src={picture} alt="" draggable={false} loading="lazy" crossOrigin="anonymous" />
        {premium && <PremiumMark />}
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

// A grid read from the database a page at a time as it scrolls into view, so
// a category or a search over tens of thousands of elements stays light;
// \`after\` (built-in parts) follows once the database has no more. learn()
// registers what arrived so a click can place it. Keyed by its query.
// fetchPage: where the pages come from (elements unless given; photos use
// fetchCreatePhotos)
export function DbGrid({ query, after = [], renderTile, learn, columns = "three", fetchPage = fetchCreatePage }) {
  const [parts, setParts] = useState([]);
  const [done, setDone] = useState(false);
  const state = useRef({ page: 0, busy: false });
  const end = useRef(null);
  // the latest query and learn(), without restarting the observer each render
  const latest = useRef({ query, learn, fetchPage });
  useEffect(() => {
    latest.current = { query, learn, fetchPage };
  });

  useEffect(() => {
    const node = end.current;
    if (!node || done) return;
    let alive = true;
    const load = async () => {
      const st = state.current;
      if (st.busy) return;
      st.busy = true;
      try {
        const { query: q, learn: register, fetchPage: fetcher } = latest.current;
        const { parts: next, total } = await fetcher({ perPage: PAGE, ...q, page: st.page + 1 });
        if (!alive) return;
        st.page += 1;
        register?.(next);
        setParts((list) => {
          const seen = new Set(list.map((p) => p.id));
          return [...list, ...next.filter((p) => !seen.has(p.id))];
        });
        if (!next.length || st.page * (q.perPage ?? PAGE) >= total) setDone(true);
      } catch {
        if (alive) setDone(true);
      } finally {
        st.busy = false;
      }
    };
    const watch = new IntersectionObserver((entries) => entries[0].isIntersecting && load());
    watch.observe(node);
    return () => {
      alive = false;
      watch.disconnect();
    };
  }, [done, parts.length]);

  const seen = new Set(parts.map((p) => p.id));
  const tail = done ? after.filter((p) => !seen.has(p.id)) : [];
  return (
    <>
      <div className={columns === "masonry" ? "cp-masonry" : `cp-grid ${columns}`}>{[...parts, ...tail].map(renderTile)}</div>
      {!done && <div ref={end} className="cp-more" aria-hidden="true" />}
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
  if (kind === "table") {
    const t = TABLE_STYLES.find(([style]) => style === id);
    return t && <TableTile key={key} style={t[0]} label={t[1]} dragItem={dragItem} />;
  }
  if (kind === "frame") {
    const f = photoFrames.find((x) => x.id === id);
    return f && <FrameTile key={key} frame={f} dragItem={dragItem} />;
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

// onAddQr(text): puts a new QR code on the page
function ElementsPanel({ dragItem: placeItem, uploaded = [], learn, onAddQr, onOpenMockup }) {
  const elements = useMemo(() => [...uploaded, ...trialElements], [uploaded]);
  const categories = useMemo(() => mergeCategories(uploaded), [uploaded]);
  // how many each category really holds (the overview loads only the newest),
  // and a picture for a category none of the newest belong to
  const [dbCounts, setDbCounts] = useState(null);
  const [covers, setCovers] = useState({});
  useEffect(() => {
    let alive = true;
    countCreateCategories(ELEMENT_CATEGORIES.map((id) => [id, elementCategoryStorageValues(id)]))
      .then(async (counts) => {
        if (!alive) return;
        setDbCounts(counts);
        const missing = ELEMENT_CATEGORIES.filter(
          (id) => counts[id] > 0 && !uploaded.some((el) => normalizeElementCategory(el.category) === id)
        );
        const found = await Promise.all(missing.map((id) =>
          fetchCreatePage({ stored: elementCategoryStorageValues(id), perPage: 1 })
            .then((r) => [id, r.parts[0]])
            .catch(() => [id, null])
        ));
        if (alive) setCovers(Object.fromEntries(found.filter(([, part]) => part)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uploaded]);
  const uploadedIn = (id) => uploaded.filter((el) => normalizeElementCategory(el.category) === id).length;
  const countOf = (c) => (dbCounts ? c.items.length - uploadedIn(c.id) + (dbCounts[c.id] ?? 0) : c.items.length);
  const allCategories = useMemo(() => {
    const list = [...categories];
    for (const id of ELEMENT_CATEGORIES) {
      if (dbCounts?.[id] && !list.some((c) => c.id === id)) list.push({ id, name: elementCategoryLabel(id), items: [] });
    }
    return list.map((c) => ({ ...c, cover: c.cover ?? c.items[0]?.thumb ?? covers[c.id]?.thumb }));
  }, [categories, dbCounts, covers]);
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
  // the Photos library: how many it holds and a cover, read once
  const [stockPhotos, setStockPhotos] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchCreatePhotos({ perPage: 1 })
      .then((r) => alive && setStockPhotos({ total: r.total, cover: r.parts[0]?.thumb }))
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const mockups = useMockups();
  const setIcons = iconCatalog.icons;
  const setGroups = useMemo(() => iconCatalog.sets.map((set) => ({
    set,
    icons: setIcons.filter((icon) => icon.setId === set.id),
  })).filter((group) => group.icons.length > 0), [iconCatalog.sets, setIcons]);
  const iconCount = basicIcons.length + setIcons.length;
  const shapeCategory = allCategories.find((c) => c.id === "shapes");
  const browsableCategories = allCategories.filter((c) => c.id !== "shapes" && countOf(c) > 0);
  // the open category, the existing icon catalog, built-in shapes, or recent items
  const [view, setView] = useState(null);
  const browseTiles = [
    ...browsableCategories.filter((c) => ["graphics", "infographics", "grids"].includes(c.id)).map((c) => ({
      ...c,
      count: countOf(c),
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
      count: shapes.length + (shapeCategory ? countOf(shapeCategory) : 0),
      picture: shapeCategory?.cover ?? SHAPES_PREVIEW,
      onOpen: () => setView("shapes"),
    },
    {
      id: "photo-frames",
      name: "Photo frames",
      count: photoFrames.length,
      picture: frameArt(photoFrames[4]),
      onOpen: () => setView("photo-frames"),
    },
    {
      id: "tables",
      name: "Tables",
      count: TABLE_STYLES.length,
      picture: tableArt("header"),
      onOpen: () => setView("tables"),
    },
    {
      id: "qr",
      name: "QR code",
      count: 1,
      premium: true,
      picture: QR_PREVIEW,
      onOpen: () => setView("qr"),
    },
    ...browsableCategories.filter((c) => c.id === "frames" || c.id === "photos").map((c) => ({
      ...c,
      count: countOf(c),
      picture: c.cover,
      onOpen: () => setView(c.id),
    })),
    // mockups with a kit, opened in the Mockup Studio
    ...(mockups?.length
      ? [{ id: "mockups", name: "Mockups", count: mockups.length, picture: mockups[0].image, onOpen: () => setView("mockups") }]
      : []),
    // the Photos library itself, not a copy of it
    ...(stockPhotos?.total
      ? [{ id: "stock-photos", name: "Photos", count: stockPhotos.total, picture: stockPhotos.cover, onOpen: () => setView("stock-photos") }]
      : []),
    ...browsableCategories
      .filter((c) => !["graphics", "infographics", "grids", "frames", "photos"].includes(c.id))
      .map((c) => ({ ...c, count: countOf(c), picture: c.cover, onOpen: () => setView(c.id) })),
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

  // recently used elements older than the overview's newest, read by code
  const [older, setOlder] = useState([]);
  useEffect(() => {
    const known = new Set([...elements, ...older].map((e) => e.id));
    const missing = recent.filter((r) => r.kind === "element" && /^KD-/.test(r.id) && !known.has(r.id)).map((r) => r.id);
    if (!missing.length) return;
    let alive = true;
    fetchCreatePartsByCode(missing)
      .then((parts) => {
        if (!alive || !parts.length) return;
        learn?.(parts);
        setOlder((list) => [...list, ...parts]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [recent, elements, older, learn]);

  const recentTiles = recent.map((r) => recentTile(r, dragItem, [...elements, ...older], setIcons)).filter(Boolean);

  const elementTile = (el) => <ElementTile key={el.id} el={el} dragItem={dragItem} />;

  /* one section in full */
  if (view) {
    const category = allCategories.find((c) => c.id === view);
    // uploaded parts come from the database page by page, then the built-in ones
    const fromDb = dbCounts && ELEMENT_CATEGORIES.includes(view);
    return (
      <>
        <button className="cp-back" onClick={() => setView(null)}>
          <Icon name="arrowLeft" size={16} />
          {category?.name ?? (view === "recent" ? "Recently used" : view === "shapes" ? "Shapes" : view === "photo-frames" ? "Photo frames" : view === "stock-photos" ? "Photos" : view === "qr" ? "QR code" : view === "tables" ? "Tables" : view === "mockups" ? "Mockups" : "Icons")}
        </button>

        {category && view !== "shapes" && (fromDb
          ? <DbGrid key={view} query={{ stored: elementCategoryStorageValues(view) }} after={trialOf(view)} renderTile={elementTile} learn={learn} />
          : <PagedGrid items={category.items} renderTile={elementTile} />)}

        {view === "shapes" && (
          <ShapeTiles
            list={shapeCategory?.items ?? []}
            dragItem={dragItem}
            uploadedCount={shapeCategory ? countOf(shapeCategory) : 0}
            uploadedGrid={fromDb && shapeCategory && countOf(shapeCategory) > 0
              ? <DbGrid key="shapes" query={{ stored: elementCategoryStorageValues("shapes") }} after={trialOf("shapes")} renderTile={elementTile} learn={learn} />
              : null}
          />
        )}

        {view === "photo-frames" && (
          <>
            <div className="cp-grid three">
              {photoFrames.map((f) => <FrameTile key={f.id} frame={f} dragItem={dragItem} />)}
            </div>
            <p className="cp-hint">Add a frame, then drag a photo onto it. The photo is cut to the frame's shape.</p>
          </>
        )}

        {view === "qr" && <QrPanel onAdd={(text) => onAddQr?.(text)} />}

        {view === "tables" && <TableTiles dragItem={dragItem} />}

        {view === "mockups" && <MockupTiles mockups={mockups} onOpen={(m) => onOpenMockup?.(m)} />}

        {view === "stock-photos" && (
          <DbGrid key="stock-photos" query={{}} fetchPage={fetchCreatePhotos} columns="two" learn={learn}
                  renderTile={(p) => <StockPhotoTile key={p.id} photo={p} dragItem={dragItem} />} />
        )}

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
            premium={category.premium}
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
