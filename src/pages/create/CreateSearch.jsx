// One search for the whole Khulqidesign library, as Canva has one box for all
// of its content. Results come in sections, the open tab's kind first, each
// with a short row and "See all". What can't go on a page (logos and footage)
// is linked to its own library page.
import { useMemo, useState } from "react";
import Icon from "./CreateIcons";
import { basicIcons } from "./basicIcons";
import { shapes } from "./createLibrary";
import { BasicTile, ElementTile, PagedGrid, SetIconTile, ShapeTile } from "./CreateElements";
import { saveRecent, withRecent } from "./createRecent";
import { PhotoTile } from "./CreateBackground";
import { QrPanel } from "./CreateQr";
import { elements as trialElements } from "../../data/elementsData";
import { matchesSearch } from "../../lib/search";
import { pathFor } from "../../lib/router";

// words that only name a kind of asset ("home icon" means home)
const KIND_WORDS = [
  "icon", "icons", "vector", "vectors", "template", "templates", "element", "elements",
  "graphic", "graphics", "background", "backgrounds", "shape", "shapes",
];

const textOf = (item) =>
  [item.name, item.label, item.title, item.category, item.searchText, ...(item.keywords ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const indexed = (list) => list.map((item) => ({ item, text: textOf(item) }));

function find(list, query) {
  const q = query.trim().toLowerCase();
  // on its own, a word like "icon" is the search itself
  const kinds = q.includes(" ") ? KIND_WORDS : [];
  return list.filter(({ text }) => matchesSearch(q, (term) => text.includes(term), kinds)).map(({ item }) => item);
}

// a free vector goes on the page; a Premium one opens on the Vectors page,
// so its clean picture never reaches a design
function VectorTile({ vector, dragItem }) {
  const free = vector.license === "free";
  const action = free
    ? dragItem("vector", vector.id)
    : { onClick: () => window.open(pathFor("vectors", vector.title), "_blank", "noopener") };
  return (
    <button className="cp-tile wide" {...action} title={vector.title}>
      <img src={vector.image} alt={vector.title} draggable={false} loading="lazy" crossOrigin="anonymous" />
      {!free && <span className="cp-badge">Premium</span>}
    </button>
  );
}

// searches that mean "make a QR code": the maker itself comes first
const QR_SEARCH = /\b(qr|qrcode|barcode)\b/i;

function CreateSearch({ query, tab, templates, uploaded, backgrounds, photo, library, dragItem: placeItem, templateTile, onAddQr }) {
  // the section open in full ("See all")
  const [view, setView] = useState(null);
  const dragItem = withRecent(placeItem, saveRecent);

  const sources = useMemo(
    () => ({
      templates: indexed(templates),
      elements: indexed([...shapes, ...uploaded, ...trialElements]),
      icons: indexed([...basicIcons, ...library.icons]),
      vectors: indexed(library.vectors),
      backgrounds: indexed(backgrounds),
    }),
    [templates, uploaded, backgrounds, library]
  );

  const elementTile = (e) =>
    e.url
      ? <ElementTile key={e.id} el={e} dragItem={dragItem} />
      : <ShapeTile key={e.id} shape={e} dragItem={dragItem} />;
  const iconTile = (i) =>
    i.svg
      ? <BasicTile key={i.id} icon={i} dragItem={dragItem} />
      : <SetIconTile key={i.id} icon={i} dragItem={dragItem} />;

  const sections = [
    { id: "templates", title: "Templates", columns: "masonry", tile: templateTile },
    { id: "elements", title: "Elements", columns: "three", tile: elementTile },
    { id: "icons", title: "Icons", columns: "three", tile: iconTile },
    { id: "vectors", title: "Vectors", columns: "two", tile: (v) => <VectorTile key={v.id} vector={v} dragItem={dragItem} /> },
    {
      id: "backgrounds",
      title: "Backgrounds",
      columns: "two",
      tile: (p) => <PhotoTile key={p.id} photo={p} on={photo === p.url} dragItem={dragItem} />,
    },
  ]
    .map((s) => ({ ...s, items: find(sources[s.id], query) }))
    .filter((s) => s.items.length > 0);

  // the open tab's kind comes first
  const first = tab === "background" ? "backgrounds" : tab;
  sections.sort((a, b) => (b.id === first) - (a.id === first));

  const open = sections.find((s) => s.id === view);
  if (open) {
    return (
      <>
        <button className="cp-back" onClick={() => setView(null)}>
          <Icon name="arrowLeft" size={16} /> {open.title}
        </button>
        <PagedGrid items={open.items} columns={open.columns} renderTile={open.tile} />
      </>
    );
  }

  const term = query.trim();
  const wantsQr = QR_SEARCH.test(term) && onAddQr;
  return (
    <>
      {wantsQr && (
        <div className="cp-found">
          <QrPanel onAdd={onAddQr} focus={false} />
        </div>
      )}
      {sections.length === 0 && !wantsQr && <p className="cp-hint">Nothing found for “{term}”.</p>}

      {sections.map((s) => {
        const short = s.items.slice(0, s.columns === "three" ? 6 : 4);
        return (
          <div key={s.id} className="cp-found">
            <div className="cp-head">
              <p className="cp-label">{s.title}</p>
              {s.items.length > short.length && (
                <button className="cp-all" onClick={() => setView(s.id)}>See all ({s.items.length})</button>
              )}
            </div>
            <div className={s.columns === "masonry" ? "cp-masonry" : `cp-grid ${s.columns}`}>{short.map(s.tile)}</div>
          </div>
        );
      })}

      <div className="cp-found">
        <p className="cp-label">Also in the library</p>
        <div className="cp-links">
          <a href={pathFor("logos", term)} target="_blank" rel="noopener noreferrer">Logos</a>
          <a href={pathFor("footage", term)} target="_blank" rel="noopener noreferrer">Footage</a>
        </div>
      </div>
    </>
  );
}

export default CreateSearch;
