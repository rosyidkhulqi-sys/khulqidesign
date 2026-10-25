import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  ActiveSelection,
  Canvas,
  Circle,
  Color,
  FabricImage,
  Group,
  Line,
  Rect,
  Textbox,
  Triangle,
  loadSVGFromString,
  util,
} from "fabric";
import PageHeader from "./PageHeader";
import TemplateThumb from "./TemplateThumb";
import { allTemplates } from "./templatesData";
import {
  artboardPresets,
  fonts,
  libraryFootage,
  libraryIcons,
  libraryVectors,
  shapes,
  svgDataUrl,
  textPresets,
} from "./createLibrary";
import "./Create.css";

const DRAFT_KEY = "kd-create-draft";
const DRAG_TYPE = "application/x-kd-item";

const tabs = [
  { id: "templates", label: "Templates", icon: "▦" },
  { id: "elements", label: "Elements", icon: "◆" },
  { id: "text", label: "Text", icon: "T" },
  { id: "icons", label: "Icons", icon: "★" },
  { id: "vectors", label: "Vectors", icon: "✎" },
  { id: "footage", label: "Footage", icon: "▶" },
  { id: "uploads", label: "Uploads", icon: "⇪" },
];

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}

const toHex = (c) => `#${new Color(c).toHex().toLowerCase()}`;

// every drawable leaf of an object (groups and selections are flattened)
const leaves = (obj) =>
  obj instanceof Group ? obj.getObjects().flatMap(leaves) : [obj];

function colorsOf(obj) {
  const found = new Set();
  leaves(obj).forEach((l) => {
    [l.fill, l.stroke].forEach((c) => {
      if (typeof c === "string" && c && c !== "none" && c !== "transparent") {
        found.add(toHex(c));
      }
    });
  });
  return [...found].slice(0, 10);
}

// crop an image to fill w×h, like CSS object-fit: cover
async function imageCover(src, w, h) {
  const img = await FabricImage.fromURL(src);
  const scale = Math.max(w / img.width, h / img.height);
  const cw = w / scale;
  const ch = h / scale;
  img.set({
    cropX: (img.width - cw) / 2,
    cropY: (img.height - ch) / 2,
    width: cw,
    height: ch,
    scaleX: scale,
    scaleY: scale,
  });
  return img;
}

function sceneObjects(scene) {
  return Promise.all(
    scene.elements.map(async (el) => {
      if (el.type === "rect") {
        return new Rect({ left: el.x, top: el.y, width: el.w, height: el.h, rx: el.r || 0, ry: el.r || 0, fill: el.fill, strokeWidth: 0 });
      }
      if (el.type === "circle") {
        return new Circle({ left: el.x, top: el.y, radius: el.r, fill: el.fill, strokeWidth: 0 });
      }
      if (el.type === "image") {
        const img = await imageCover(el.src, el.w, el.h);
        img.set({ left: el.x, top: el.y });
        return img;
      }
      return new Textbox(el.text, {
        left: el.x,
        top: el.y,
        width: el.w,
        fontSize: el.size,
        fontWeight: el.weight || 400,
        fontFamily: el.font,
        fill: el.fill,
        textAlign: el.align || "left",
      });
    })
  );
}

function Create({ setPage, draft, clearDraft }) {
  const canvasEl = useRef(null);
  const stageRef = useRef(null);
  const fc = useRef(null);
  const boardRef = useRef({ w: 1080, h: 1080 });
  const history = useRef({ undo: [], redo: [], busy: false });
  const commitTimer = useRef(null);
  const fileInput = useRef(null);

  const [board, setBoard] = useState({ w: 1080, h: 1080 });
  const [bg, setBg] = useState("#ffffff");
  const [stage, setStage] = useState({ w: 800, h: 600 });
  const [zoomMode, setZoomMode] = useState("fit");
  const [tab, setTab] = useState(draft ? "templates" : "elements");
  const [active, setActive] = useState(null);
  const [, setTick] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showNew, setShowNew] = useState(() => !draft && !loadDraft());
  const [custom, setCustom] = useState({ w: 1080, h: 1080 });
  const [lockRatio, setLockRatio] = useState(true);
  const [uploads, setUploads] = useState([]);

  const zoom =
    zoomMode === "fit"
      ? Math.max(0.05, Math.min((stage.w - 80) / board.w, (stage.h - 80) / board.h))
      : zoomMode;

  const refresh = () => setTick((t) => t + 1);

  /* ---------- history & draft ---------- */

  const snapshot = () =>
    JSON.stringify({ ...boardRef.current, json: fc.current.toJSON() });

  const syncHistory = () => {
    setCanUndo(history.current.undo.length > 1);
    setCanRedo(history.current.redo.length > 0);
  };

  const persist = (snap) => {
    try {
      localStorage.setItem(DRAFT_KEY, snap);
    } catch {
      /* storage full or unavailable */
    }
  };

  const resetHistory = () => {
    const snap = snapshot();
    history.current = { undo: [snap], redo: [], busy: false };
    persist(snap);
    syncHistory();
  };

  const commit = () => {
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      const h = history.current;
      if (h.busy || !fc.current) return;
      const snap = snapshot();
      if (h.undo[h.undo.length - 1] === snap) return;
      h.undo.push(snap);
      if (h.undo.length > 50) h.undo.shift();
      h.redo = [];
      persist(snap);
      syncHistory();
    }, 250);
  };

  const setBoardSize = (size) => {
    boardRef.current = size;
    setBoard(size);
  };

  const restore = async (snap) => {
    const c = fc.current;
    history.current.busy = true;
    setBoardSize({ w: snap.w, h: snap.h });
    await c.loadFromJSON(snap.json);
    c.discardActiveObject();
    c.requestRenderAll();
    setBg(c.backgroundColor || "#ffffff");
    setActive(null);
    history.current.busy = false;
  };

  const undo = async () => {
    const h = history.current;
    if (h.undo.length < 2) return;
    h.redo.push(h.undo.pop());
    await restore(JSON.parse(h.undo[h.undo.length - 1]));
    persist(h.undo[h.undo.length - 1]);
    syncHistory();
  };

  const redo = async () => {
    const h = history.current;
    const snap = h.redo.pop();
    if (!snap) return;
    h.undo.push(snap);
    await restore(JSON.parse(snap));
    persist(snap);
    syncHistory();
  };

  /* ---------- documents ---------- */

  const newArtboard = (w, h) => {
    const c = fc.current;
    c.clear();
    c.backgroundColor = "#ffffff";
    setBg("#ffffff");
    setBoardSize({ w, h });
    setActive(null);
    setShowNew(false);
    resetHistory();
  };

  const openTemplate = async (t, ask = true) => {
    const c = fc.current;
    if (ask && c.getObjects().length && !window.confirm("Replace the current design with this template?")) {
      return;
    }
    // text metrics are wrong if the web font is not loaded yet
    await Promise.all([
      document.fonts.load('400 40px "Space Grotesk"'),
      document.fonts.load('700 40px "Space Grotesk"'),
    ]).catch(() => {});
    const objects = await sceneObjects(t.scene);
    c.clear();
    c.backgroundColor = t.scene.bg;
    setBg(t.scene.bg);
    setBoardSize({ w: t.scene.w, h: t.scene.h });
    objects.forEach((o) => c.add(o));
    c.requestRenderAll();
    setActive(null);
    setShowNew(false);
    resetHistory();
  };

  /* ---------- adding elements ---------- */

  const place = (obj, point) => {
    const c = fc.current;
    const b = boardRef.current;
    const cx = point ? point.x : b.w / 2;
    const cy = point ? point.y : b.h / 2;
    obj.set({ left: cx - obj.getScaledWidth() / 2, top: cy - obj.getScaledHeight() / 2 });
    obj.setCoords();
    c.add(obj);
    c.setActiveObject(obj);
    c.requestRenderAll();
    setActive(obj);
    commit();
  };

  const unit = () => Math.min(boardRef.current.w, boardRef.current.h);

  const addShape = (id, point) => {
    const s = unit() * 0.3;
    const base = { fill: "#e7212e", strokeWidth: 0 };
    const make = {
      rect: () => new Rect({ ...base, width: s, height: s }),
      rounded: () => new Rect({ ...base, width: s, height: s, rx: s * 0.15, ry: s * 0.15 }),
      circle: () => new Circle({ ...base, radius: s / 2 }),
      triangle: () => new Triangle({ ...base, width: s, height: s }),
      line: () => new Line([0, 0, s * 1.5, 0], { stroke: "#1d1d1d", strokeWidth: Math.max(4, s * 0.03) }),
    };
    place(make[id](), point);
  };

  const addText = (preset, point) => {
    const k = unit() / 1080;
    const text = new Textbox(preset.label, {
      width: boardRef.current.w * 0.6,
      fontSize: Math.round(preset.size * k),
      fontWeight: preset.weight,
      fontFamily: "Space Grotesk",
      fill: "#1d1d1d",
    });
    place(text, point);
  };

  const addSvg = async (markup, point) => {
    const { objects, options } = await loadSVGFromString(markup);
    const obj = util.groupSVGElements(objects.filter(Boolean), options);
    obj.scaleToWidth(unit() * 0.3);
    place(obj, point);
  };

  const addImage = async (src, point) => {
    const img = await FabricImage.fromURL(src);
    const b = boardRef.current;
    img.scale(Math.min((b.w * 0.5) / img.width, (b.h * 0.5) / img.height));
    place(img, point);
  };

  const addItem = ({ kind, id }, point) => {
    if (kind === "shape") return addShape(id, point);
    if (kind === "text") return addText(textPresets.find((t) => t.id === id), point);
    if (kind === "icon") return addSvg(libraryIcons.find((i) => i.id === id).svg, point);
    if (kind === "vector") return addImage(libraryVectors.find((v) => v.id === id).src, point);
    if (kind === "footage") return addImage(libraryFootage.find((f) => f.id === id).poster, point);
    if (kind === "upload") {
      const u = uploads.find((x) => x.id === id);
      return u.type === "svg" ? addSvg(u.data, point) : addImage(u.data, point);
    }
  };

  const readFile = (file) =>
    new Promise((resolve) => {
      const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ id: `${Date.now()}-${file.name}`, name: file.name, type: isSvg ? "svg" : "image", data: reader.result });
      if (isSvg) reader.readAsText(file);
      else reader.readAsDataURL(file);
    });

  const handleFiles = async (files, point) => {
    const list = await Promise.all(
      [...files].filter((f) => /svg|png|jpe?g|webp/i.test(f.type || f.name)).map(readFile)
    );
    setUploads((u) => [...list, ...u]);
    for (const u of list) {
      await (u.type === "svg" ? addSvg(u.data, point) : addImage(u.data, point));
    }
  };

  const dragItem = (kind, id) => ({
    draggable: true,
    onDragStart: (e) => e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind, id })),
    onClick: () => addItem({ kind, id }),
  });

  const onDrop = (e) => {
    e.preventDefault();
    const point = fc.current.getScenePoint(e.nativeEvent);
    if (e.dataTransfer.files.length) return handleFiles(e.dataTransfer.files, point);
    const data = e.dataTransfer.getData(DRAG_TYPE);
    if (data) addItem(JSON.parse(data), point);
  };

  /* ---------- editing the selection ---------- */

  const render = () => {
    fc.current.requestRenderAll();
    refresh();
    commit();
  };

  const setProp = (props) => {
    active.set(props);
    active.setCoords();
    render();
  };

  const changeColor = (from, to) => {
    leaves(active).forEach((l) => {
      if (typeof l.fill === "string" && l.fill && toHex(l.fill) === from) l.set("fill", to);
      if (typeof l.stroke === "string" && l.stroke && toHex(l.stroke) === from) l.set("stroke", to);
    });
    active.set("dirty", true);
    render();
  };

  const setSize = (dim, value) => {
    const v = Math.max(1, Number(value) || 1);
    if (active instanceof Textbox) return setProp({ width: v / active.scaleX });
    const ratio = active.getScaledHeight() / active.getScaledWidth();
    if (dim === "w") {
      const scaleX = v / active.width;
      setProp(lockRatio ? { scaleX, scaleY: (v * ratio) / active.height } : { scaleX });
    } else {
      const scaleY = v / active.height;
      setProp(lockRatio ? { scaleY, scaleX: v / ratio / active.width } : { scaleY });
    }
  };

  const arrange = (how) => {
    const c = fc.current;
    if (how === "front") c.bringObjectToFront(active);
    if (how === "forward") c.bringObjectForward(active);
    if (how === "backward") c.sendObjectBackwards(active);
    if (how === "back") c.sendObjectToBack(active);
    render();
  };

  const duplicate = async () => {
    const c = fc.current;
    const obj = c.getActiveObject();
    if (!obj) return;
    const clone = await obj.clone();
    c.discardActiveObject();
    clone.set({ left: clone.left + 30, top: clone.top + 30 });
    if (clone instanceof ActiveSelection) {
      clone.canvas = c;
      clone.forEachObject((o) => c.add(o));
      clone.setCoords();
    } else {
      c.add(clone);
    }
    c.setActiveObject(clone);
    setActive(clone);
    render();
  };

  const remove = () => {
    const c = fc.current;
    c.getActiveObjects().forEach((o) => c.remove(o));
    c.discardActiveObject();
    setActive(null);
    render();
  };

  const group = () => {
    const c = fc.current;
    const objects = active.removeAll();
    c.discardActiveObject();
    c.remove(...objects);
    const g = new Group(objects);
    c.add(g);
    c.setActiveObject(g);
    setActive(g);
    render();
  };

  // split a group (e.g. an imported SVG) so each part can be recolored or deleted
  const ungroup = () => {
    const c = fc.current;
    const index = c.getObjects().indexOf(active);
    const objects = active.removeAll();
    c.remove(active);
    c.insertAt(index, ...objects);
    const sel = new ActiveSelection(objects, { canvas: c });
    c.setActiveObject(sel);
    setActive(sel);
    render();
  };

  const setBackground = (color) => {
    fc.current.backgroundColor = color;
    setBg(color);
    fc.current.requestRenderAll();
    commit();
  };

  const exportFile = (format) => {
    const c = fc.current;
    const b = boardRef.current;
    c.discardActiveObject();
    c.renderAll();
    setActive(null);

    let url;
    if (format === "svg") {
      const markup = c.toSVG({ width: b.w, height: b.h, viewBox: { x: 0, y: 0, width: b.w, height: b.h } });
      url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    } else {
      url = c.toDataURL({ format: format === "jpg" ? "jpeg" : "png", quality: 0.92, multiplier: 1 / c.getZoom() });
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = `khulqidesign-${b.w}x${b.h}.${format}`;
    a.click();
  };

  /* ---------- canvas lifecycle ---------- */

  const syncSelection = useEffectEvent(() => {
    setActive(fc.current.getActiveObject() || null);
    refresh();
  });

  const onModified = useEffectEvent(() => {
    syncSelection();
    commit();
  });

  const start = useEffectEvent(async () => {
    if (draft) {
      await openTemplate(draft, false);
      clearDraft();
      return;
    }
    const saved = loadDraft();
    if (saved) await restore(saved);
    resetHistory();
  });

  const onKey = useEffectEvent((e) => {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const obj = fc.current?.getActiveObject();
    if (obj?.isEditing) return;

    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    } else if (mod && e.key.toLowerCase() === "d" && obj) {
      e.preventDefault();
      duplicate();
    } else if ((e.key === "Delete" || e.key === "Backspace") && obj) {
      e.preventDefault();
      remove();
    }
  });

  useEffect(() => {
    const c = new Canvas(canvasEl.current, {
      preserveObjectStacking: true,
      backgroundColor: "#ffffff",
    });
    fc.current = c;
    c.on("selection:created", syncSelection);
    c.on("selection:updated", syncSelection);
    c.on("selection:cleared", syncSelection);
    c.on("object:modified", onModified);
    Promise.resolve().then(start);

    return () => {
      clearTimeout(commitTimer.current);
      c.dispose();
      fc.current = null;
    };
  }, []);

  useEffect(() => {
    const handler = (e) => onKey(e);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setStage({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const c = fc.current;
    c.setZoom(zoom);
    c.setDimensions({ width: Math.round(board.w * zoom), height: Math.round(board.h * zoom) });
    c.requestRenderAll();
  }, [board, zoom]);

  /* ---------- render ---------- */

  const isText = active instanceof Textbox;
  const isSelection = active instanceof ActiveSelection;
  const isGroup = active instanceof Group && !isSelection;
  const hasStroke = active instanceof Rect || active instanceof Circle || active instanceof Triangle;

  return (
    <section className="create-page">
      <PageHeader page="create" setPage={setPage} />

      <div className="create-editor">
        {/* TOP BAR */}
        <div className="create-topbar">
          <button className="ct-btn primary" onClick={() => setShowNew(true)}>+ New</button>
          <button className="ct-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↶</button>
          <button className="ct-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">↷</button>

          <span className="ct-size">{board.w} × {board.h} px</span>

          <select
            className="ct-select"
            value={zoomMode}
            onChange={(e) => setZoomMode(e.target.value === "fit" ? "fit" : Number(e.target.value))}
          >
            <option value="fit">Fit ({Math.round(zoom * 100)}%)</option>
            {[0.25, 0.5, 0.75, 1].map((z) => (
              <option key={z} value={z}>{z * 100}%</option>
            ))}
          </select>

          <div className="ct-export">
            <span>Download</span>
            <button className="ct-btn" onClick={() => exportFile("png")}>PNG</button>
            <button className="ct-btn" onClick={() => exportFile("jpg")}>JPG</button>
            <button className="ct-btn" onClick={() => exportFile("svg")}>SVG</button>
          </div>
        </div>

        <div className="create-body">
          {/* TAB RAIL */}
          <nav className="create-rail">
            {tabs.map((t) => (
              <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          {/* LIBRARY PANEL */}
          <div className="create-panel">
            {tab === "templates" && (
              <div className="cp-grid two">
                {allTemplates.map((t) => (
                  <button key={t.id} className="cp-template" onClick={() => openTemplate(t)} title={t.title}>
                    <div style={{ aspectRatio: `${t.w} / ${t.h}` }}>
                      <TemplateThumb scene={t.scene} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {tab === "elements" && (
              <>
                <p className="cp-label">Shapes</p>
                <div className="cp-grid three">
                  {shapes.map((s) => (
                    <button key={s.id} className="cp-tile" {...dragItem("shape", s.id)} title={s.label}>
                      <span className={`shape-${s.id}`} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {tab === "text" && (
              <div className="cp-text">
                {textPresets.map((t) => (
                  <button
                    key={t.id}
                    {...dragItem("text", t.id)}
                    style={{ fontSize: t.size / 4, fontWeight: t.weight }}
                  >
                    {t.label}
                  </button>
                ))}
                <p className="cp-hint">Double-click text on the canvas to edit it.</p>
              </div>
            )}

            {tab === "icons" && (
              <>
                <div className="cp-grid three">
                  {libraryIcons.map((i) => (
                    <button key={i.id} className="cp-tile" {...dragItem("icon", i.id)} title={i.name}>
                      <img src={svgDataUrl(i.svg)} alt={i.name} />
                    </button>
                  ))}
                </div>
                <p className="cp-hint">Icons are SVG: change their colors, or Ungroup to edit each part.</p>
              </>
            )}

            {tab === "vectors" && (
              <div className="cp-grid two">
                {libraryVectors.map((v) => (
                  <button key={v.id} className="cp-tile wide" {...dragItem("vector", v.id)} title={v.name}>
                    <img src={v.src} alt={v.name} />
                  </button>
                ))}
              </div>
            )}

            {tab === "footage" && (
              <>
                <div className="cp-grid two">
                  {libraryFootage.map((f) => (
                    <button key={f.id} className="cp-tile wide play" {...dragItem("footage", f.id)} title={f.name}>
                      <img src={f.poster} alt={f.name} />
                    </button>
                  ))}
                </div>
                <p className="cp-hint">Footage is placed as a still frame for now.</p>
              </>
            )}

            {tab === "uploads" && (
              <>
                <button className="cp-upload" onClick={() => fileInput.current.click()}>
                  ⇪ Upload SVG / PNG / JPG
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg,.webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div className="cp-grid three">
                  {uploads.map((u) => (
                    <button key={u.id} className="cp-tile" {...dragItem("upload", u.id)} title={u.name}>
                      <img src={u.type === "svg" ? svgDataUrl(u.data) : u.data} alt={u.name} />
                    </button>
                  ))}
                </div>
                <p className="cp-hint">You can also drop files straight onto the canvas.</p>
              </>
            )}
          </div>

          {/* STAGE */}
          <div
            className="create-stage"
            ref={stageRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <div className="create-artboard">
              <canvas ref={canvasEl} />
            </div>
          </div>

          {/* PROPERTIES */}
          <aside className="create-props">
            {!active ? (
              <>
                <p className="cp-label">Artboard</p>
                <div className="pp-row">
                  <span>Size</span>
                  <strong>{board.w} × {board.h}</strong>
                </div>
                <label className="pp-row">
                  <span>Background</span>
                  <input type="color" value={toHex(bg)} onChange={(e) => setBackground(e.target.value)} />
                </label>
                <p className="cp-hint">Select an element to edit it.</p>
              </>
            ) : (
              <>
                {isText && (
                  <>
                    <p className="cp-label">Text</p>
                    <textarea
                      className="pp-textarea"
                      value={active.text}
                      onChange={(e) => setProp({ text: e.target.value })}
                    />
                    <select
                      className="pp-input"
                      value={active.fontFamily}
                      onChange={(e) => setProp({ fontFamily: e.target.value })}
                    >
                      {fonts.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <label className="pp-row">
                      <span>Font size</span>
                      <input
                        type="number"
                        className="pp-num"
                        value={Math.round(active.fontSize)}
                        onChange={(e) => setProp({ fontSize: Math.max(1, Number(e.target.value)) })}
                      />
                    </label>
                    <div className="pp-buttons">
                      <button
                        className={Number(active.fontWeight) >= 600 || active.fontWeight === "bold" ? "on" : ""}
                        onClick={() => setProp({ fontWeight: Number(active.fontWeight) >= 600 || active.fontWeight === "bold" ? 400 : 700 })}
                      >
                        <b>B</b>
                      </button>
                      <button
                        className={active.fontStyle === "italic" ? "on" : ""}
                        onClick={() => setProp({ fontStyle: active.fontStyle === "italic" ? "normal" : "italic" })}
                      >
                        <i>I</i>
                      </button>
                      <button
                        className={active.underline ? "on" : ""}
                        onClick={() => setProp({ underline: !active.underline })}
                      >
                        <u>U</u>
                      </button>
                      {["left", "center", "right"].map((a) => (
                        <button
                          key={a}
                          className={active.textAlign === a ? "on" : ""}
                          onClick={() => setProp({ textAlign: a })}
                          title={`Align ${a}`}
                        >
                          {a === "left" ? "⇤" : a === "center" ? "↔" : "⇥"}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {colorsOf(active).length > 0 && (
                  <>
                    <p className="cp-label">Colors</p>
                    <div className="pp-colors">
                      {colorsOf(active).map((c) => (
                        <input key={c} type="color" value={c} onChange={(e) => changeColor(c, e.target.value)} />
                      ))}
                    </div>
                  </>
                )}

                {hasStroke && (
                  <label className="pp-row">
                    <span>Border</span>
                    <input
                      type="number"
                      className="pp-num"
                      min="0"
                      value={active.strokeWidth}
                      onChange={(e) => setProp({ strokeWidth: Math.max(0, Number(e.target.value)), stroke: active.stroke || "#1d1d1d" })}
                    />
                  </label>
                )}

                {active instanceof Rect && (
                  <label className="pp-row">
                    <span>Corner radius</span>
                    <input
                      type="number"
                      className="pp-num"
                      min="0"
                      value={Math.round(active.rx)}
                      onChange={(e) => setProp({ rx: Number(e.target.value), ry: Number(e.target.value) })}
                    />
                  </label>
                )}

                <p className="cp-label">Size & position</p>
                <div className="pp-pair">
                  <label>
                    W
                    <input
                      type="number"
                      className="pp-num"
                      value={Math.round(active.getScaledWidth())}
                      onChange={(e) => setSize("w", e.target.value)}
                    />
                  </label>
                  {!isText && (
                    <label>
                      H
                      <input
                        type="number"
                        className="pp-num"
                        value={Math.round(active.getScaledHeight())}
                        onChange={(e) => setSize("h", e.target.value)}
                      />
                    </label>
                  )}
                  {!isText && (
                    <button
                      className={`pp-lock ${lockRatio ? "on" : ""}`}
                      onClick={() => setLockRatio(!lockRatio)}
                      title="Keep proportions"
                    >
                      {lockRatio ? "🔒" : "🔓"}
                    </button>
                  )}
                </div>
                <label className="pp-row">
                  <span>Rotation</span>
                  <input
                    type="number"
                    className="pp-num"
                    value={Math.round(active.angle)}
                    onChange={(e) => {
                      active.rotate(Number(e.target.value) || 0);
                      active.setCoords();
                      render();
                    }}
                  />
                </label>
                <label className="pp-row">
                  <span>Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(active.opacity * 100)}
                    onChange={(e) => setProp({ opacity: Number(e.target.value) / 100 })}
                  />
                </label>

                <p className="cp-label">Arrange</p>
                <div className="pp-buttons">
                  <button onClick={() => arrange("front")} title="Bring to front">⤒</button>
                  <button onClick={() => arrange("forward")} title="Bring forward">↑</button>
                  <button onClick={() => arrange("backward")} title="Send backward">↓</button>
                  <button onClick={() => arrange("back")} title="Send to back">⤓</button>
                  <button onClick={() => setProp({ flipX: !active.flipX })} title="Flip horizontal">⇋</button>
                  <button onClick={() => setProp({ flipY: !active.flipY })} title="Flip vertical">⇵</button>
                </div>

                <div className="pp-actions">
                  {isSelection && <button onClick={group}>Group</button>}
                  {isGroup && <button onClick={ungroup}>Ungroup</button>}
                  <button onClick={duplicate}>Duplicate</button>
                  <button className="danger" onClick={remove}>Delete</button>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      {/* NEW DESIGN */}
      {showNew && (
        <div className="create-modal-overlay">
          <div className="create-modal">
            <h2>Create a new design</h2>
            <div className="cn-presets">
              {artboardPresets.map((p) => (
                <button key={p.label} onClick={() => newArtboard(p.w, p.h)}>
                  <span className="cn-shape">
                    <span style={{ aspectRatio: `${p.w} / ${p.h}` }} />
                  </span>
                  <strong>{p.label}</strong>
                  <small>{p.ratio} · {p.w}×{p.h}</small>
                </button>
              ))}
            </div>

            <div className="cn-custom">
              <span>Custom size</span>
              <input
                type="number"
                value={custom.w}
                onChange={(e) => setCustom({ ...custom, w: Number(e.target.value) })}
              />
              ×
              <input
                type="number"
                value={custom.h}
                onChange={(e) => setCustom({ ...custom, h: Number(e.target.value) })}
              />
              px
              <button
                className="ct-btn primary"
                disabled={custom.w < 16 || custom.h < 16 || custom.w > 8000 || custom.h > 8000}
                onClick={() => newArtboard(custom.w, custom.h)}
              >
                Create
              </button>
            </div>

            <div className="cn-footer">
              <button className="ct-btn" onClick={() => { setShowNew(false); setTab("templates"); }}>
                Start from a template
              </button>
              <button className="ct-btn" onClick={() => setShowNew(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Create;
