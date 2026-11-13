import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { askConfirm } from "../../lib/confirm";
import {
  ActiveSelection,
  Canvas,
  Circle,
  Ellipse,
  FabricImage,
  Group,
  Line,
  Path,
  Polygon,
  Rect,
  Textbox,
  Triangle,
  loadSVGFromString,
  util,
} from "fabric";
import Icon from "./CreateIcons";
import ElementsPanel from "./CreateElements";
import BackgroundPanel from "./CreateBackground";
import CreateSearch from "./CreateSearch";
import { SearchBox } from "./CreateElements";
import TemplateThumb from "../../components/TemplateThumb";
import { allTemplates } from "../../data/templatesData";
import { elements as libraryElements } from "../../data/elementsData";
import { basicIcons } from "./basicIcons";
import { artboardPresets, shapes, svgDataUrl, textPresets } from "./createLibrary";
import { loadFont, loadFontsOf, loadSiteFonts } from "./createFonts";
import FontPicker from "./FontPicker";
import CreateShapeToolbar from "./CreateShapeToolbar";
import "./createHandles";
import { regularPolygonPath } from "./shapePath";
import CreateColors, { CreateColorPanel } from "./CreateColors";
import { colorObjectKey, toHex } from "./colorTools";
import { attachGuides } from "./createGuides";
import { beginCrop } from "./createCrop";
import ProjectsPanel from "./CreateProjects";
import LayersPanel from "./CreateLayers";
import AiPanel from "./CreateAi";
import {
  currentProjectId,
  deleteProject,
  listProjects,
  loadProject,
  migrateOldDraft,
  newProjectId,
  renameProject,
  saveProject,
  setCurrentProject,
} from "./projectsStore";
import "./Create.css";
import { supabase } from "../../lib/supabaseClient";
import PublishTemplate from "./PublishTemplate";
import { fetchTemplates } from "./templatePublish";
import { fetchIconCatalog, fetchPublished, toCreatePart, toVector } from "../../lib/catalog";
import { askLogin } from "../../lib/authGate";
import { aiReady } from "../../lib/ai";
import { MODELS, removeBackground, upscale } from "../../lib/aiLocal";

const PANEL_KEY = "kd-create-panel";
const PAGE_KEY = "kd-create-page";
// zoom slider range, in percent
const ZOOM_MIN = 10;
const ZOOM_MAX = 300;
// height of the page bar above the artboard and Add page below it
const PAGE_CHROME = 96;
const DRAG_TYPE = "application/x-kd-item";
const UNTITLED = "Untitled design";

// icons, vectors and footage live inside Elements, as Canva groups them
const tabs = ["templates", "elements", "background", "text", "uploads", "layers", "projects", "ai"];
// the tabs that browse the library, under the one search box
const SEARCH_TABS = ["templates", "elements", "background"];
const tabLabel = (t) => (t === "ai" ? "AI" : t[0].toUpperCase() + t.slice(1));

const exportFormats = [
  ["png", "PNG", "High quality image"],
  ["jpg", "JPG", "Smaller file size"],
  ["svg", "SVG", "Scalable vector"],
];

const isLocked = (obj) => Boolean(obj?.lockMovementX);
// saved with a design, so a locked element stays locked after undo or reload
// saved with each object: its locks, and a basic shape's sides and corner
const LOCK_PROPS = ["lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls", "kdShape"];

// what the shape bar can change on an object: corners and sides, or just its
// outline; null for anything that isn't a basic shape
function shapeInfo(obj) {
  if (!obj || obj.isCropFrame) return null;
  if (obj instanceof Line) return { kind: "line" };
  if (obj instanceof Rect) return { kind: "rect" };
  if (obj instanceof Circle || obj instanceof Ellipse) return { kind: "round" };
  if (obj.kdShape) return { kind: "polygon", ...obj.kdShape };
  if (obj instanceof Triangle) return { kind: "polygon", sides: 3, corner: 0 };
  if (obj instanceof Polygon) return { kind: "fixed" };
  return null;
}

const SHAPE_BAR_KEY = "kd-create-shape-bar";

// crop an image to fill w×h, like CSS object-fit: cover
async function imageCover(src, w, h) {
  const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
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

// user: the signed-in account; anyone can design, downloading needs one
function Create({ draft, clearDraft, user = null }) {
  const canvasEl = useRef(null);
  const stageRef = useRef(null);
  const fc = useRef(null);
  const boardRef = useRef({ w: 1080, h: 1080 });
  const history = useRef({ undo: [], redo: [], busy: false });
  // every page of the design as Fabric JSON; list[index] is the page on the
  // canvas, so its entry is refreshed from the canvas when it's needed
  const pagesRef = useRef({ list: [null], index: 0 });
  const commitTimer = useRef(null);
  // the crop in progress: { apply(), cancel() }, or null
  const cropRef = useRef(null);
  const [cropping, setCropping] = useState(false);
  const fileInput = useRef(null);

  // phones get a one-time hint that the editor is built for bigger screens
  const [smallHint, setSmallHint] = useState(true);
  const [board, setBoard] = useState({ w: 1080, h: 1080 });
  const [bg, setBg] = useState("#ffffff");
  // the address of the page's background photo, or null
  const [bgPhoto, setBgPhoto] = useState(null);
  // only the last background chosen counts, however slowly a photo loads
  const bgRequest = useRef(0);
  const [stage, setStage] = useState({ w: 800, h: 600 });
  const [zoomMode, setZoomMode] = useState("fit");
  const [tab, setTab] = useState(draft ? "templates" : "elements");
  // the library panel can be hidden to give the canvas more room (remembered)
  const [panelOpen, setPanelOpen] = useState(() => {
    try {
      return localStorage.getItem(PANEL_KEY) !== "closed";
    } catch {
      return true;
    }
  });
  const [active, setActive] = useState(null);
  const [colorEditor, setColorEditor] = useState(null);
  const [, setTick] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // autosave state shown in the top bar: "saved", "saving" or "error"
  const [saveState, setSaveState] = useState("saved");
  // the design to reopen: the last one open, else the newest (the old
  // single saved design becomes a project first)
  const [opening] = useState(() => {
    migrateOldDraft();
    const list = listProjects();
    const last = list.find((p) => p.id === currentProjectId()) ?? list[0] ?? null;
    return { id: last?.id ?? null, name: last?.name ?? UNTITLED, any: list.length > 0 };
  });
  // the open project's id; null until a new design has something to save
  const projectRef = useRef(opening.id);
  // the same id as state, for the Projects list to mark the open design
  const [openId, setOpenId] = useState(opening.id);
  const switchProject = (id) => {
    projectRef.current = id;
    setOpenId(id);
    if (id) setCurrentProject(id);
  };
  const nameRef = useRef(opening.name);
  // true once the open design is on the canvas; until then there is nothing
  // to save, and saving would write an empty canvas over that design
  const loadedRef = useRef(false);
  const [projects, setProjects] = useState(listProjects);
  const [showNew, setShowNew] = useState(() => !draft && !opening.any);
  const [custom, setCustom] = useState({ w: 1080, h: 1080 });
  const [lockRatio, setLockRatio] = useState(true);
  const [uploads, setUploads] = useState([]);
  const [name, setName] = useState(opening.name);
  const [menu, setMenu] = useState(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [pageInfo, setPageInfo] = useState({ index: 0, count: 1 });
  const [fullscreen, setFullscreen] = useState(false);
  // admins can publish the open design as a template
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [aiOperation, setAiOperation] = useState(null);
  const aiBusy = Boolean(aiOperation && !aiOperation.error);
  // templates published from Create, ahead of the built-in ones
  const [dbTemplates, setDbTemplates] = useState([]);
  // elements and backgrounds uploaded on /admin
  const [dbParts, setDbParts] = useState([]);
  // the one search box; icons and vectors load the first time it's used
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState({ icons: [], vectors: [] });
  const libraryAsked = useRef(false);
  const allDesigns = useMemo(() => [...dbTemplates, ...allTemplates], [dbTemplates]);
  const dbElements = useMemo(() => dbParts.filter((p) => p.kind === "element"), [dbParts]);
  const dbBackgrounds = useMemo(() => dbParts.filter((p) => p.kind === "background"), [dbParts]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      supabase.rpc("is_admin").then(({ data: ok }) => alive && setIsAdmin(ok === true));
    });
    fetchTemplates()
      .then((list) => alive && setDbTemplates(list))
      .catch(() => {
        /* the built-in templates still show */
      });
    fetchPublished("element")
      .then((rows) => alive && setDbParts(rows.map(toCreatePart)))
      .catch(() => {
        /* the built-in elements still show */
      });
    return () => {
      alive = false;
    };
  }, []);
  const editorRef = useRef(null);

  // follow the browser's full-screen state, including leaving it with Esc
  useEffect(() => {
    const sync = () =>
      setFullscreen((document.fullscreenElement || document.webkitFullscreenElement) === editorRef.current);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  // the editor alone fills the screen; Safari still uses the webkit names
  const toggleFullscreen = () => {
    const el = editorRef.current;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  };
  const [dragging, setDragging] = useState(false);

  const zoom =
    zoomMode === "fit"
      ? Math.max(0.05, Math.min((stage.w - 80) / board.w, (stage.h - 80 - PAGE_CHROME) / board.h))
      : zoomMode;

  // the Layers panel lists the top element first, the canvas the bottom one
  const [layers, setLayers] = useState([]);
  const refresh = () => {
    setTick((t) => t + 1);
    if (fc.current) setLayers(fc.current.getObjects().filter((o) => !o.isCropFrame).reverse());
  };

  /* ---------- history & draft ---------- */

  // the pages with the one on the canvas refreshed
  const currentPages = () => {
    const p = pagesRef.current;
    return p.list.map((json, i) => (i === p.index ? fc.current.toObject(LOCK_PROPS) : json));
  };

  // a whole design: size and every page (which page is open is kept apart,
  // so moving between pages isn't an undo step)
  const snapshot = () =>
    JSON.stringify({ ...boardRef.current, pages: currentPages() });

  const syncPages = () =>
    setPageInfo({ index: pagesRef.current.index, count: pagesRef.current.list.length });

  const rememberPage = (i) => {
    try {
      localStorage.setItem(PAGE_KEY, String(i));
    } catch {
      /* storage unavailable */
    }
  };

  const syncHistory = () => {
    setCanUndo(history.current.undo.length > 1);
    setCanRedo(history.current.redo.length > 0);
  };

  // a small picture of page 1 for the Projects list. The canvas is set to
  // the thumbnail's size just for this, then put back, so the picture is
  // whole whatever the zoom is (or before the first zoom is applied).
  const thumbnail = () => {
    const c = fc.current;
    const b = boardRef.current;
    const view = c.viewportTransform.slice();
    const size = { width: c.getWidth(), height: c.getHeight() };
    const s = 280 / Math.max(b.w, b.h);
    try {
      c.setViewportTransform([s, 0, 0, s, 0, 0]);
      c.setDimensions({ width: Math.round(b.w * s), height: Math.round(b.h * s) });
      return c.toDataURL({ format: "jpeg", quality: 0.7 });
    } catch {
      return undefined;
    } finally {
      c.setDimensions(size);
      c.setViewportTransform(view);
    }
  };

  // saves the design into its project; false when the browser refuses
  // (storage full or blocked). A new, still empty design isn't saved, so
  // opening Create doesn't fill Projects with blank designs.
  const persist = (snap) => {
    const c = fc.current;
    const pages = pagesRef.current;
    if (!projectRef.current) {
      // a page with only a background is a design too
      if (pages.list.length === 1 && c && !c.getObjects().length && !c.backgroundImage && toHex(c.backgroundColor) === "#ffffff") return true;
      switchProject(newProjectId());
    }
    const b = boardRef.current;
    const meta = { name: nameRef.current, w: b.w, h: b.h, pages: pages.list.length };
    if (pages.index === 0 && c) meta.thumb = thumbnail();
    const ok = saveProject(projectRef.current, snap, meta);
    setProjects(listProjects());
    return ok;
  };

  // saves right away, before leaving this design
  const flushSave = () => {
    clearTimeout(commitTimer.current);
    if (loadedRef.current && fc.current && !history.current.busy) persist(snapshot());
  };

  const resetHistory = () => {
    const snap = snapshot();
    history.current = { undo: [snap], redo: [], busy: false };
    setSaveState(persist(snap) ? "saved" : "error");
    syncHistory();
  };

  // shows "Saving…" while a change waits, then "Saved" or "Not saved"
  const commit = () => {
    clearTimeout(commitTimer.current);
    setSaveState("saving");
    commitTimer.current = setTimeout(() => {
      const h = history.current;
      // mid-crop the picture is expanded; the crop's end saves the result
      if (h.busy || !fc.current || cropRef.current) return setSaveState("saved");
      const snap = snapshot();
      if (h.undo[h.undo.length - 1] === snap) return setSaveState("saved");
      h.undo.push(snap);
      if (h.undo.length > 50) h.undo.shift();
      h.redo = [];
      setSaveState(persist(snap) ? "saved" : "error");
      syncHistory();
    }, 250);
  };

  const syncBackground = () => {
    const c = fc.current;
    setBg(typeof c.backgroundColor === "string" ? c.backgroundColor : c.backgroundColor?.colorStops?.[0]?.color || "#ffffff");
    setBgPhoto(c.backgroundImage?.getSrc() ?? null);
  };

  const setBoardSize = (size) => {
    boardRef.current = size;
    setBoard(size);
  };

  // loads a saved design; drafts from before pages existed have one "json"
  const restore = async (snap, index = pagesRef.current.index) => {
    const c = fc.current;
    history.current.busy = true;
    await loadFontsOf(snap);
    setBoardSize({ w: snap.w, h: snap.h });
    const list = snap.pages ?? [snap.json];
    const i = Math.max(0, Math.min(index, list.length - 1));
    pagesRef.current = { list, index: i };
    await c.loadFromJSON(list[i]);
    c.discardActiveObject();
    c.requestRenderAll();
    syncBackground();
    setActive(null);
    syncPages();
    history.current.busy = false;
  };

  /* ---------- pages ---------- */

  // puts page i on the canvas; save: keep the edits of the page being left
  const showPage = async (i, save = true) => {
    const p = pagesRef.current;
    const c = fc.current;
    if (save) p.list[p.index] = c.toObject(LOCK_PROPS);
    p.index = i;
    history.current.busy = true;
    await c.loadFromJSON(p.list[i]);
    c.discardActiveObject();
    c.requestRenderAll();
    syncBackground();
    setActive(null);
    history.current.busy = false;
    syncPages();
    rememberPage(i);
  };

  const goToPage = async (i) => {
    if (i < 0 || i >= pagesRef.current.list.length || i === pagesRef.current.index) return;
    await showPage(i);
    commit();
  };

  // a blank page, or a copy of the open one, right after it
  const addPage = async (copy = false) => {
    const p = pagesRef.current;
    p.list[p.index] = fc.current.toObject(LOCK_PROPS);
    const page = copy
      ? structuredClone(p.list[p.index])
      : { version: p.list[p.index].version, objects: [], background: "#ffffff" };
    p.list.splice(p.index + 1, 0, page);
    await showPage(p.index + 1, false);
    commit();
  };

  const deletePage = async () => {
    const p = pagesRef.current;
    if (p.list.length < 2) return;
    if (fc.current.getObjects().length && !(await askConfirm({ title: "Delete this page?", message: "Everything on it goes too.", confirmLabel: "Delete page" }))) return;
    p.list.splice(p.index, 1);
    await showPage(Math.min(p.index, p.list.length - 1), false);
    commit();
  };

  // a new or replaced design starts with one page
  const resetPages = () => {
    pagesRef.current = { list: [null], index: 0 };
    syncPages();
    rememberPage(0);
  };

  const undo = async () => {
    const h = history.current;
    if (h.undo.length < 2) return;
    h.redo.push(h.undo.pop());
    await restore(JSON.parse(h.undo[h.undo.length - 1]));
    setSaveState(persist(h.undo[h.undo.length - 1]) ? "saved" : "error");
    syncHistory();
  };

  const redo = async () => {
    const h = history.current;
    const snap = h.redo.pop();
    if (!snap) return;
    h.undo.push(snap);
    await restore(JSON.parse(snap));
    setSaveState(persist(snap) ? "saved" : "error");
    syncHistory();
  };

  /* ---------- documents ---------- */

  const renameDesign = (value) => {
    setName(value);
    nameRef.current = value;
    if (projectRef.current) {
      renameProject(projectRef.current, value);
      setProjects(listProjects());
    }
  };

  // clears the canvas for a fresh one-page design
  const blankCanvas = () => {
    const c = fc.current;
    c.clear();
    c.backgroundColor = "#ffffff";
    syncBackground();
    setActive(null);
    resetPages();
  };

  // opens a saved design from Projects; the one being left is saved first
  const openProject = async (id, saveCurrent = true) => {
    if (id === projectRef.current) return;
    const snap = loadProject(id);
    if (!snap) return;
    if (saveCurrent) flushSave();
    switchProject(id);
    const meta = listProjects().find((p) => p.id === id);
    setName(meta?.name || UNTITLED);
    nameRef.current = meta?.name || UNTITLED;
    await restore(snap, 0);
    rememberPage(0);
    setShowNew(false);
    resetHistory();
  };

  const showPanel = (open) => {
    setPanelOpen(open);
    try {
      localStorage.setItem(PANEL_KEY, open ? "open" : "closed");
    } catch {
      /* storage unavailable */
    }
  };

  // switching tabs from anywhere also brings a hidden panel back
  const openTab = (name) => {
    setTab(name);
    setQuery("");
    showPanel(true);
  };

  // a new design is a new project; the current one stays in Projects
  const newArtboard = (w, h) => {
    flushSave();
    switchProject(null);
    renameDesign(UNTITLED);
    blankCanvas();
    setBoardSize({ w, h });
    setShowNew(false);
    resetHistory();
  };

  // deletes a design from Projects; deleting the open one moves to the
  // newest other design, or to a blank canvas when none is left
  const deleteDesign = async (id = projectRef.current) => {
    if (!(await askConfirm({ title: "Delete this design?", message: "This can't be undone.", confirmLabel: "Delete design" }))) return;
    clearTimeout(commitTimer.current);
    if (id) deleteProject(id);
    setProjects(listProjects());
    if (id && id !== projectRef.current) return;

    switchProject(null);
    const next = listProjects()[0];
    if (next) return openProject(next.id, false);

    setName(UNTITLED);
    nameRef.current = UNTITLED;
    blankCanvas();
    history.current = { undo: [snapshot()], redo: [], busy: false };
    syncHistory();
    setShowNew(true);
  };

  // in the editor a template replaces the open design (after asking);
  // asNew starts a new project for it, as when it comes from the Templates page
  const openTemplate = async (t, ask = true, asNew = false) => {
    const c = fc.current;
    if (ask && c.getObjects().length && !(await askConfirm({
      title: "Replace your design with this template?",
      message: "What's on your pages now is replaced, and this can't be undone. To keep it, start a new design from File first.",
      confirmLabel: "Replace design",
    }))) {
      return;
    }
    if (asNew) {
      flushSave();
      switchProject(null);
    }
    // text metrics are wrong if the web font is not loaded yet
    await loadSiteFonts();
    // a published template is a saved design: every page as it was made
    if (t.designUrl) {
      let snap;
      try {
        snap = await (await fetch(t.designUrl)).json();
      } catch {
        window.alert("This template couldn't be opened. Check your connection and try again.");
        return;
      }
      renameDesign(t.title[0].toUpperCase() + t.title.slice(1));
      await restore(snap, 0);
      rememberPage(0);
      setShowNew(false);
      resetHistory();
      return;
    }
    const objects = await sceneObjects(t.scene);
    renameDesign(t.title[0].toUpperCase() + t.title.slice(1));
    c.clear();
    c.backgroundColor = t.scene.bg;
    setBgPhoto(null);
    setBg(t.scene.bg);
    setBoardSize({ w: t.scene.w, h: t.scene.h });
    objects.forEach((o) => c.add(o));
    c.requestRenderAll();
    setActive(null);
    setShowNew(false);
    resetPages();
    resetHistory();
  };

  const searching = SEARCH_TABS.includes(tab) && query.trim() !== "";

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
    const definition = shapes.find((shape) => shape.id === id);
    if (!definition) return;
    const base = { fill: "#000000", strokeWidth: 0 };
    let object;

    if (definition.kind === "rect") object = new Rect({ ...base, width: s, height: s });
    else if (definition.kind === "rounded") object = new Rect({ ...base, width: s, height: s, rx: s * 0.15, ry: s * 0.15 });
    else if (definition.kind === "circle") object = new Circle({ ...base, radius: s / 2 });
    else if (definition.kind === "oval") object = new Ellipse({ ...base, rx: s / 2, ry: s * 0.34 });
    else if (definition.kind === "triangle") object = new Triangle({ ...base, width: s, height: s });
    else if (definition.kind === "polygon") {
      object = new Polygon(definition.points.map(({ x, y }) => ({ x: (x / 100) * s, y: (y / 100) * s })), base);
    } else if (definition.kind === "line") {
      const dash = definition.dash?.map((value) => Math.max(1, value * (unit() / 1080)));
      object = new Line([0, 0, s * 1.5, 0], {
        fill: null,
        stroke: "#000000",
        strokeWidth: Math.max(2, s * 0.012),
        strokeDashArray: dash,
        strokeLineCap: definition.cap,
      });
    }

    if (object) place(object, point);
  };

  const addText = (preset, point) => {
    const k = unit() / 1080;
    const text = new Textbox(preset.label, {
      width: boardRef.current.w * 0.8,
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
    const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
    const b = boardRef.current;
    img.scale(Math.min((b.w * 0.5) / img.width, (b.h * 0.5) / img.height));
    place(img, point);
  };

  const addItem = ({ kind, id }, point) => {
    if (kind === "shape") return addShape(id, point);
    if (kind === "text") return addText(textPresets.find((t) => t.id === id), point);
    if (kind === "basic") return addSvg(basicIcons.find((i) => i.id === id).svg, point);
    // the same SVG files as the Icons page, so their colors stay editable
    if (kind === "icon") {
      const icon = library.icons.find((i) => i.id === id);
      if (!icon) return;
      return fetch(icon.image).then((r) => r.text()).then((markup) => addSvg(markup, point));
    }
    // element files: SVG stays editable vector, PNG goes in as an image
    if (kind === "element") {
      const el = dbElements.find((e) => e.id === id) ?? libraryElements.find((e) => e.id === id);
      if (el.type !== "svg") return addImage(el.url, point);
      return fetch(el.url).then((r) => r.text()).then((markup) => addSvg(markup, point));
    }
    if (kind === "vector") {
      const vector = library.vectors.find((v) => v.id === id);
      return addImage(vector.previewImage ?? vector.image, point);
    }
    if (kind === "background") return setBackgroundPhoto(dbBackgrounds.find((p) => p.id === id).url);
    if (kind === "upload") {
      const u = uploads.find((x) => x.id === id);
      return u.type === "svg" ? addSvg(u.data, point) : addImage(u.data, point);
    }
  };

  const runImageAi = async (operation, scale = 2) => {
    const c = fc.current;
    const image = c?.getActiveObject();
    if (!(image instanceof FabricImage) || (aiOperation && !aiOperation.error)) return;
    const index = c.getObjects().indexOf(image);
    const original = {
      left: image.left,
      top: image.top,
      originX: image.originX,
      originY: image.originY,
      width: image.getScaledWidth(),
      height: image.getScaledHeight(),
      angle: image.angle,
      opacity: image.opacity,
      flipX: image.flipX,
      flipY: image.flipY,
      skewX: image.skewX,
      skewY: image.skewY,
      scaleX: image.scaleX,
      scaleY: image.scaleY,
      cropX: image.cropX || 0,
      cropY: image.cropY || 0,
      imageWidth: image.width,
      imageHeight: image.height,
    };
    const originalMatrix = image.calcTransformMatrix();
    const sourceSize = image.getOriginalSize();

    setAiOperation({ operation, step: "Preparing image", progress: 0 });
    try {
      const response = await fetch(image.getSrc());
      if (!response.ok) throw new Error("Could not read this image. Try uploading it again.");
      const source = await response.blob();
      const input = new File([source], "create-image", { type: source.type || "image/png" });
      const onStep = (step, progress) => setAiOperation({ operation, step, progress });
      const processed = operation === "cutout"
        ? await removeBackground(input, onStep, { cropToSubject: true })
        : await upscale(input, onStep, scale);
      const cropBounds = operation === "cutout" ? processed.bounds : null;
      const result = cropBounds ? processed.blob : processed;
      if (cropBounds) setAiOperation({ operation, step: "Cropping artboard", progress: 1 });

      // Store the processed result as a data URL so it remains part of the
      // saved design after the temporary object URL has been released.
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not prepare the processed image."));
        reader.readAsDataURL(result);
      });
      const replacement = await FabricImage.fromURL(dataUrl);
      if (!c.getObjects().includes(image)) throw new Error("The selected image changed before processing finished. Please try again.");
      let replacementLeft = original.left;
      let replacementTop = original.top;
      let replacementOriginX = original.originX;
      let replacementOriginY = original.originY;
      let replacementScaleX = original.width / replacement.width;
      let replacementScaleY = original.height / replacement.height;
      if (cropBounds) {
        const scaleToSourceX = sourceSize.width / cropBounds.sourceWidth;
        const scaleToSourceY = sourceSize.height / cropBounds.sourceHeight;
        const cropCenterX = (cropBounds.left + cropBounds.width / 2) * scaleToSourceX;
        const cropCenterY = (cropBounds.top + cropBounds.height / 2) * scaleToSourceY;
        const dx = cropCenterX - (original.cropX + original.imageWidth / 2);
        const dy = cropCenterY - (original.cropY + original.imageHeight / 2);
        replacementLeft = originalMatrix[4] + originalMatrix[0] * dx + originalMatrix[2] * dy;
        replacementTop = originalMatrix[5] + originalMatrix[1] * dx + originalMatrix[3] * dy;
        replacementOriginX = "center";
        replacementOriginY = "center";
        replacementScaleX = original.scaleX * scaleToSourceX;
        replacementScaleY = original.scaleY * scaleToSourceY;
      }
      replacement.set({
        left: replacementLeft,
        top: replacementTop,
        originX: replacementOriginX,
        originY: replacementOriginY,
        scaleX: replacementScaleX,
        scaleY: replacementScaleY,
        angle: original.angle,
        opacity: original.opacity,
        flipX: original.flipX,
        flipY: original.flipY,
        skewX: original.skewX,
        skewY: original.skewY,
      });
      replacement.setCoords();
      c.remove(image);
      c.insertAt(Math.max(0, index), replacement);
      c.setActiveObject(replacement);
      c.requestRenderAll();
      setActive(replacement);
      refresh();
      commit();
      setAiOperation(null);
    } catch (error) {
      setAiOperation({ operation, error: error.message || "The image couldn't be processed. Try again." });
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

  /* ---------- picking a color from the page ---------- */

  // the angle shown while an element is being turned: { angle, x, y }
  const [rotation, setRotation] = useState(null);

  // set while the eyedropper is on: { apply, x, y, hex }
  const [picker, setPicker] = useState(null);

  const pickFromPage = (apply) => setPicker({ apply, x: 0, y: 0, hex: null });

  // the pixel under the pointer, from the rendered page (not the selection
  // handles, which sit on a canvas above it)
  const colorAt = (e) => {
    const lower = fc.current?.lowerCanvasEl;
    if (!lower) return null;
    const r = lower.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * lower.width);
    const y = Math.floor(((e.clientY - r.top) / r.height) * lower.height);
    if (x < 0 || y < 0 || x >= lower.width || y >= lower.height) return null;
    try {
      const [red, green, blue] = lower.getContext("2d").getImageData(x, y, 1, 1).data;
      return `#${[red, green, blue].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    } catch {
      // a picture from another site without permission can't be read
      return null;
    }
  };

  useEffect(() => {
    if (!picker) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setPicker(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [picker]);

  /* ---------- basic shape bar ---------- */

  // minimized to a small tab at the top right, as Illustrator's panels
  const [shapeBarClosed, setShapeBarClosed] = useState(() => {
    try {
      return localStorage.getItem(SHAPE_BAR_KEY) === "closed";
    } catch {
      return false;
    }
  });
  const toggleShapeBar = () => {
    setShapeBarClosed((closed) => {
      try {
        localStorage.setItem(SHAPE_BAR_KEY, closed ? "open" : "closed");
      } catch {
        /* storage unavailable */
      }
      return !closed;
    });
  };

  // a triangle or polygon becomes a path with its sides and corner rounding,
  // the same size and in the same place
  const rebuildPolygon = (next) => {
    const c = fc.current;
    const obj = active;
    const index = c.getObjects().indexOf(obj);
    const center = obj.getCenterPoint();
    const sides = Math.max(3, Math.min(20, Math.round(next.sides)));
    const corner = Math.max(0, next.corner);
    // the shape's own size, kept with it: a path's box also counts its curve
    // handles, so reading it back would make the shape grow on every change
    const w = (obj.kdShape?.w ?? obj.width) * obj.scaleX;
    const h = (obj.kdShape?.h ?? obj.height) * obj.scaleY;
    const path = new Path(regularPolygonPath(w, h, sides, corner), {
      fill: obj.fill,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
      strokeUniform: true,
      opacity: obj.opacity,
      angle: obj.angle,
      flipX: obj.flipX,
      flipY: obj.flipY,
      kdShape: { sides, corner, w, h },
    });
    path.setPositionByOrigin(center, "center", "center");
    path.setCoords();
    c.remove(obj);
    c.insertAt(Math.max(0, index), path);
    c.setActiveObject(path);
    setActive(path);
    render();
  };

  const shapeCorner = () => {
    const info = shapeInfo(active);
    if (info?.kind === "rect") return (active.rx || 0) * active.scaleX;
    if (info?.kind === "polygon") return info.corner;
    return 0;
  };

  const setShapeCorner = (value) => {
    const info = shapeInfo(active);
    if (info.kind === "rect") setProp({ rx: value / active.scaleX, ry: value / active.scaleY });
    else rebuildPolygon({ sides: info.sides, corner: value });
  };

  const setShapeSides = (sides) => rebuildPolygon({ sides, corner: shapeInfo(active)?.corner ?? 0 });
  const setShapeWeight = (width) =>
    setShapeStroke({ strokeWidth: shapeInfo(active)?.kind === "line" ? Math.max(1, width) : width });
  const setShapeColor = (stroke) => setShapeStroke({ stroke });

  const setShapeStroke = (props) => {
    // an outline only shows with some width, so picking a color gives it one
    if (props.stroke && !active.strokeWidth) props.strokeWidth = 2;
    setProp({ ...props, strokeUniform: true });
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

  const startCrop = () => {
    const c = fc.current;
    const image = c.getActiveObject();
    if (cropRef.current || !(image instanceof FabricImage) || isLocked(image)) return;
    cropRef.current = beginCrop(c, image);
    setCropping(true);
    refresh();
  };

  const finishCrop = (keep) => {
    const session = cropRef.current;
    if (!session) return;
    if (keep) session.apply();
    else session.cancel();
    cropRef.current = null;
    setCropping(false);
    refresh();
    if (keep) commit();
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

  const setLocked = (obj, lock) => {
    obj.set({
      lockMovementX: lock,
      lockMovementY: lock,
      lockScalingX: lock,
      lockScalingY: lock,
      lockRotation: lock,
      hasControls: !lock,
    });
    render();
  };

  const toggleLock = () => setLocked(active, !isLocked(active));

  const selectLayer = (obj) => {
    const c = fc.current;
    c.setActiveObject(obj);
    c.requestRenderAll();
    refresh();
  };

  const moveLayer = (from, to) => {
    const c = fc.current;
    c.moveObjectTo(layers[from], layers.length - 1 - to);
    render();
  };

  const toggleHidden = (obj) => {
    const c = fc.current;
    const hide = obj.visible;
    if (hide && c.getActiveObject() === obj) c.discardActiveObject();
    obj.set("visible", !hide);
    render();
  };

  // a color replaces the photo; otherwise the choice wouldn't show
  const setBackground = (paint, previewColor = paint) => {
    bgRequest.current += 1;
    fc.current.backgroundImage = undefined;
    fc.current.backgroundColor = paint;
    setBg(typeof previewColor === "string" ? previewColor : "#ffffff");
    setBgPhoto(null);
    fc.current.requestRenderAll();
    commit();
  };

  // a canvas background: it fills the page, stays behind every element, and
  // saves, undoes and exports with the design
  const setBackgroundPhoto = async (src) => {
    const request = ++bgRequest.current;
    const img = await imageCover(src, boardRef.current.w, boardRef.current.h);
    if (request !== bgRequest.current) return;
    fc.current.backgroundImage = img;
    setBgPhoto(src);
    fc.current.requestRenderAll();
    commit();
  };

  const search = (text) => {
    setQuery(text);
    if (libraryAsked.current) return;
    libraryAsked.current = true;
    Promise.allSettled([fetchIconCatalog(), fetchPublished("vector")]).then(
      ([icons, vectors]) => {
        // codes as ids: rows published together can share a timestamp
        setLibrary({
          icons: (icons.value?.icons ?? []).map((i) => ({ ...i, id: i.code })),
          vectors: (vectors.value ?? []).map((row) => ({ ...toVector(row), id: row.code })),
        });
      }
    );
  };

  const templateTile = (t) => (
    <button key={t.dbId ?? t.id} className="cp-template" onClick={() => openTemplate(t)} title={t.title}>
      <div style={{ aspectRatio: `${t.w} / ${t.h}` }}>
        {t.scene ? <TemplateThumb scene={t.scene} /> : <img src={t.image} alt="" loading="lazy" />}
      </div>
    </button>
  );

  const exportFile = (format) => {
    // the design is autosaved on this device, so nothing is lost meanwhile
    if (!user) {
      askLogin("design");
      return;
    }
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
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { index, list } = pagesRef.current;
    const pageTag = list.length > 1 ? `-page-${index + 1}` : "";
    a.download = `${slug || "khulqidesign"}-${b.w}x${b.h}${pageTag}.${format}`;
    a.click();
  };

  /* ---------- canvas lifecycle ---------- */

  const syncSelection = useEffectEvent(() => {
    setActive(fc.current.getActiveObject() || null);
    refresh();
  });

  const onDoubleClick = useEffectEvent(({ target }) => {
    if (target instanceof FabricImage) startCrop();
  });

  const onModified = useEffectEvent(() => {
    if (cropRef.current) return;
    syncSelection();
    commit();
  });

  const syncEmpty = useEffectEvent(() => {
    setIsEmpty(fc.current.getObjects().length === 0);
    refresh();
  });

  // hide the floating toolbar while an element is being dragged or resized
  const onTransform = useEffectEvent(() => setDragging(true));
  // while turning: Shift steps by 15°, and the angle shows by the pointer
  const onRotating = useEffectEvent((opt) => {
    const target = opt.target;
    if (opt.e?.shiftKey) {
      target.rotate(Math.round(target.angle / 15) * 15);
      target.setCoords();
    }
    setRotation({ angle: Math.round(target.angle) % 360, x: opt.e?.clientX ?? 0, y: opt.e?.clientY ?? 0 });
    setDragging(true);
  });
  const onMouseUp = useEffectEvent(() => {
    setDragging(false);
    setRotation(null);
    refresh();
  });

  const start = useEffectEvent(async () => {
    if (draft) {
      await openTemplate(draft, false, true);
      clearDraft();
      loadedRef.current = true;
      return;
    }
    await loadSiteFonts();
    const saved = projectRef.current ? loadProject(projectRef.current) : null;
    if (saved) {
      let page = 0;
      try {
        page = Number(localStorage.getItem(PAGE_KEY)) || 0;
      } catch {
        /* storage unavailable */
      }
      await restore(saved, page);
    }
    resetHistory();
    loadedRef.current = true;
  });

  const onKey = useEffectEvent((e) => {
    if (aiBusy) return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const obj = fc.current?.getActiveObject();
    if (obj?.isEditing) return;

    if (cropRef.current) {
      if (e.key === "Enter") finishCrop(true);
      if (e.key === "Escape") finishCrop(false);
      return;
    }

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
    c.on("object:added", syncEmpty);
    c.on("object:removed", syncEmpty);
    c.on("object:moving", onTransform);
    c.on("object:scaling", onTransform);
    c.on("object:rotating", onRotating);
    c.on("mouse:up", onMouseUp);
    c.on("mouse:dblclick", onDoubleClick);
    c.on("text:editing:entered", syncSelection);
    c.on("text:editing:exited", syncSelection);
    c.on("text:changed", syncSelection);
    const detachGuides = attachGuides(c, () => boardRef.current);
    Promise.resolve().then(start);

    return () => {
      clearTimeout(commitTimer.current);
      detachGuides();
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
  const shapeBar = shapeInfo(active);
  const isGroup = active instanceof Group && !isSelection;
  const isLine = active instanceof Line;
  const lineStyle = !active?.strokeDashArray?.length
    ? "solid"
    : active.strokeDashArray[0] <= active.strokeDashArray[1] * 0.5 ? "dotted" : "dashed";
  const locked = isLocked(active);

  // place the quick-action toolbar above the selection (below it near the top edge)
  let floatPos = null;
  if (active && !dragging && !active.isEditing) {
    const pts = active.getCoords();
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const top = Math.min(...ys) * zoom;
    floatPos = {
      left: ((Math.min(...xs) + Math.max(...xs)) / 2) * zoom,
      // clear of the corner dots above, and of the rotate dot when it sits below
      top: top > 66 ? top - 62 : Math.max(...ys) * zoom + 50,
    };
  }

  return (
    <section className="create-page">
      {/* only shown on narrow screens (see Create.css); editing still works */}
      {smallHint && (
        <div className="create-small-hint" role="status">
          <span>Create works best on a computer or tablet.</span>
          <button onClick={() => setSmallHint(false)} aria-label="Dismiss">Got it</button>
        </div>
      )}

      <div className="create-editor" ref={editorRef}>
        {/* TOP BAR */}
        <div className="create-topbar" inert={cropping || aiBusy}>
          <div className="ct-menu">
            <button className="ct-btn" onClick={() => setMenu(menu === "file" ? null : "file")}>
              <Icon name="menu" /> File
            </button>
            {menu === "file" && (
              <div className="ct-dropdown">
                <button onClick={() => { setMenu(null); setShowNew(true); }}>
                  <Icon name="plus" /> New design
                </button>
                <button onClick={() => { setMenu(null); openTab("templates"); }}>
                  <Icon name="templates" /> Start from a template
                </button>
                {isAdmin && (
                  <button onClick={() => { setMenu(null); setShowPublish(true); }}>
                    <Icon name="templates" /> Publish as template
                  </button>
                )}
                <hr />
                <button className="danger" onClick={() => { setMenu(null); deleteDesign(); }}>
                  <Icon name="trash" /> Delete design
                </button>
              </div>
            )}
          </div>

          <input
            className="ct-name"
            value={name}
            onChange={(e) => renameDesign(e.target.value)}
            onBlur={() => !name.trim() && renameDesign(UNTITLED)}
            aria-label="Design name"
          />

          <div className="ct-history">
            <button className="ct-icon-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Icon name="undo" />
            </button>
            <button className="ct-icon-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
              <Icon name="redo" />
            </button>
          </div>

          {/* autosave status, like Canva's cloud icon */}
          <span
            className={`ct-saved is-${saveState}`}
            role="status"
            title={saveState === "error"
              ? "This browser couldn't save the design. Download it to keep a copy."
              : "Your design is saved in this browser"}
          >
            <Icon name={saveState === "saved" ? "cloudCheck" : "cloud"} size={18} />
            {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Not saved"}
          </span>

          <span className="ct-size">{board.w} × {board.h} px</span>

          <div className="ct-menu ct-export">
            <button className="ct-btn primary" onClick={() => setMenu(menu === "download" ? null : "download")}>
              <Icon name="download" /> Download <Icon name="chevron" size={14} />
            </button>
            {menu === "download" && (
              <div className="ct-dropdown is-right">
                {exportFormats.map(([format, label, hint]) => (
                  <button key={format} onClick={() => { setMenu(null); exportFile(format); }}>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {menu && <div className="ct-backdrop" onClick={() => setMenu(null)} />}

        <div className={`create-body ${panelOpen ? "" : "panel-closed"}`}>
          {/* TAB RAIL — the open tab's button hides and shows the panel, as in Canva */}
          <nav className="create-rail" inert={cropping || aiBusy}>
            {tabs.map((t) => (
              <button
                key={t}
                className={tab === t && panelOpen ? "active" : ""}
                onClick={() => (t === tab && panelOpen ? showPanel(false) : openTab(t))}
              >
                <Icon name={t} size={22} />
                {tabLabel(t)}
              </button>
            ))}
          </nav>

          {/* LIBRARY PANEL */}
          {/* stays in its grid column when hidden (width 0), so the canvas keeps its place */}
          <div className="create-panel" inert={!panelOpen || cropping} aria-hidden={!panelOpen}>
            {SEARCH_TABS.includes(tab) && <SearchBox value={query} onChange={search} placeholder="Search everything" />}

            {searching && (
              <CreateSearch
                key={query}
                query={query}
                tab={tab}
                templates={allDesigns}
                uploaded={dbElements}
                backgrounds={dbBackgrounds}
                photo={bgPhoto}
                library={library}
                dragItem={dragItem}
                templateTile={templateTile}
              />
            )}

            {!searching && tab === "templates" && <div className="cp-grid two">{allDesigns.map(templateTile)}</div>}

            {!searching && tab === "elements" && <ElementsPanel dragItem={dragItem} uploaded={dbElements} />}
            {!searching && tab === "background" && (
              <BackgroundPanel
                color={toHex(bg)}
                photo={bgPhoto}
                photos={dbBackgrounds}
                onColor={setBackground}
                onEditColor={() => setColorEditor({ mode: "background", color: toHex(bg) })}
                dragItem={dragItem}
              />
            )}

            {tab === "ai" && (
              <AiPanel
                aiReady={aiReady}
                hasSelectedImage={active instanceof FabricImage}
                operation={aiOperation}
                models={MODELS}
                onRun={runImageAi}
                onUpload={handleFiles}
              />
            )}

            {tab === "layers" && (
              <LayersPanel
                objects={layers}
                active={active}
                isLocked={isLocked}
                onSelect={selectLayer}
                onMove={moveLayer}
                onToggleHidden={toggleHidden}
                onToggleLock={(obj) => setLocked(obj, !isLocked(obj))}
              />
            )}

            {tab === "projects" && (
              <ProjectsPanel
                projects={projects}
                openId={openId}
                onOpen={(id) => openProject(id)}
                onDelete={(id) => deleteDesign(id)}
                onNew={() => setShowNew(true)}
              />
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

          {/* sits on the edge between the panel and the canvas; outside the
              stage, so it doesn't scroll away with the canvas */}
          <button
            className="panel-toggle"
            onClick={() => showPanel(!panelOpen)}
            aria-label={panelOpen ? "Hide panel" : "Show panel"}
            aria-expanded={panelOpen}
            title={panelOpen ? "Hide panel" : "Show panel"}
          >
            <Icon name="chevron" size={16} />
          </button>

          {/* STAGE + BOTTOM BAR */}
          <div className="create-center" inert={aiBusy}>
            {/* corners, sides and outline for a basic shape; sits above the
                canvas at the top right, so it never covers the page */}
            {shapeBar && !cropping && !locked && (
              <CreateShapeToolbar
                collapsed={shapeBarClosed}
                onToggle={toggleShapeBar}
                isLine={shapeBar.kind === "line"}
                showCorner={shapeBar.kind === "rect" || shapeBar.kind === "polygon"}
                corner={shapeCorner()}
                cornerMax={Math.round(Math.min(active.getScaledWidth(), active.getScaledHeight()) / 2)}
                onCornerChange={setShapeCorner}
                showSides={shapeBar.kind === "polygon"}
                sides={shapeBar.sides ?? 3}
                onSidesChange={setShapeSides}
                stroke={toHex(typeof active.stroke === "string" && active.stroke ? active.stroke : "#000000")}
                strokeWidth={active.strokeWidth || 0}
                onStrokeChange={setShapeWeight}
                onStrokeColor={setShapeColor}
              />
            )}
          <div
            className="create-stage"
            ref={stageRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <div className="create-pages">
            {/* the open page: number, duplicate and delete, as in Canva */}
            <div className="ct-pagebar" inert={cropping} style={{ width: Math.round(board.w * zoom) }}>
              <span>
                Page {pageInfo.index + 1}
                {pageInfo.count > 1 && ` of ${pageInfo.count}`}
              </span>
              <div>
                <button onClick={() => addPage(true)} title="Duplicate page" aria-label="Duplicate page">
                  <Icon name="copy" size={16} />
                </button>
                <button
                  onClick={deletePage}
                  disabled={pageInfo.count < 2}
                  title="Delete page"
                  aria-label="Delete page"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>

            <div className="create-artboard">
              <canvas ref={canvasEl} />

              {rotation && (
                <span className="ct-angle" style={{ left: rotation.x, top: rotation.y }}>{rotation.angle}°</span>
              )}

              {/* the eyedropper: move over the page, click to take a color */}
              {picker && (
                <div
                  className="ct-picker"
                  onPointerMove={(e) => setPicker((p) => p && { ...p, x: e.clientX, y: e.clientY, hex: colorAt(e) })}
                  onClick={(e) => {
                    const hex = colorAt(e);
                    if (hex) picker.apply(hex);
                    setPicker(null);
                  }}
                  role="application"
                  aria-label="Click the page to pick a color. Esc cancels."
                >
                  {picker.hex && (
                    <span className="ct-picker-chip" style={{ left: picker.x, top: picker.y }}>
                      <i style={{ background: picker.hex }} />
                      {picker.hex.toUpperCase()}
                    </span>
                  )}
                </div>
              )}

              {floatPos && cropping && (
                <div className="ct-float ct-float-crop" style={floatPos}>
                  <button onClick={() => finishCrop(false)}>Cancel</button>
                  <button className="on" onClick={() => finishCrop(true)}>Done</button>
                </div>
              )}

              {floatPos && !cropping && (
                <div className="ct-float" style={floatPos}>
                  {active instanceof FabricImage && !locked && (
                    <button onClick={startCrop} title="Crop (double-click)"><Icon name="crop" /></button>
                  )}
                  <button onClick={duplicate} title="Duplicate (Ctrl+D)"><Icon name="copy" /></button>
                  <button onClick={() => arrange("forward")} title="Bring forward"><Icon name="forward" /></button>
                  <button onClick={() => arrange("backward")} title="Send backward"><Icon name="backward" /></button>
                  {!isSelection && (
                    <button onClick={toggleLock} title={locked ? "Unlock" : "Lock position"} className={locked ? "on" : ""}>
                      <Icon name={locked ? "lock" : "unlock"} />
                    </button>
                  )}
                  <span />
                  <button onClick={remove} className="danger" title="Delete element (Del)"><Icon name="trash" /></button>
                </div>
              )}

              {isEmpty && !bgPhoto && toHex(bg) === "#ffffff" && !showNew && (
                <div className="ct-empty">
                  <p>Start with a template, or add text, shapes and icons from the left panel.</p>
                  <div>
                    <button onClick={() => openTab("templates")}>
                      <Icon name="templates" /> Browse templates
                    </button>
                    <button onClick={() => addText(textPresets[0])}>
                      <Icon name="text" /> Add a heading
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              className="ct-addpage"
              style={{ width: Math.round(board.w * zoom) }}
              onClick={() => addPage(false)}
              inert={cropping}
            >
              <Icon name="plus" size={16} /> Add page
            </button>
            </div>
          </div>

          {/* pages, zoom and full screen, under the canvas as in Canva */}
          <div className="create-bottombar" inert={cropping}>
            <div className="cb-pages">
              <button
                className="cb-icon"
                onClick={() => goToPage(pageInfo.index - 1)}
                disabled={pageInfo.index === 0}
                title="Previous page"
                aria-label="Previous page"
              >
                <Icon name="chevronLeft" size={16} />
              </button>
              <span>
                {pageInfo.index + 1} / {pageInfo.count}
              </span>
              <button
                className="cb-icon"
                onClick={() => goToPage(pageInfo.index + 1)}
                disabled={pageInfo.index === pageInfo.count - 1}
                title="Next page"
                aria-label="Next page"
              >
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
            <button
              className={`cb-fit ${zoomMode === "fit" ? "on" : ""}`}
              onClick={() => setZoomMode("fit")}
              title="Fit the page to the screen"
            >
              Fit
            </button>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step="1"
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoomMode(Number(e.target.value) / 100)}
              aria-label="Zoom"
            />
            <span className="cb-zoom">{Math.round(zoom * 100)}%</span>
            <span className="cb-sep" />
            <button
              className="cb-icon"
              onClick={toggleFullscreen}
              title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            >
              <Icon name={fullscreen ? "minimize" : "maximize"} size={16} />
            </button>
          </div>
          </div>

          {/* PROPERTIES */}
          <aside className="create-props" inert={cropping || aiBusy}>
            {colorEditor ? (
              <CreateColorPanel
                key={colorEditor.mode === "object" ? colorObjectKey(active) : "background"}
                object={colorEditor.mode === "object" ? active : null}
                initialColor={colorEditor.color}
                mode={colorEditor.mode}
                onBackgroundChange={setBackground}
                onChange={() => {
                  active?.set("dirty", true);
                  render();
                }}
                onClose={() => setColorEditor(null)}
              />
            ) : !active ? (
              <>
                <p className="cp-label">Artboard</p>
                <div className="pp-row">
                  <span>Size</span>
                  <strong>{board.w} × {board.h}</strong>
                </div>
                <div className="pp-row">
                  <span>Background</span>
                  <button
                    className="pp-color-chip pp-background-chip"
                    style={{ backgroundColor: bg }}
                    onClick={() => setColorEditor({ mode: "background", color: toHex(bg) })}
                    title="Edit background color"
                    aria-label="Edit background color"
                  />
                </div>
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
                    <FontPicker
                      value={active.fontFamily}
                      onPick={async (fontFamily) => {
                        await loadFont(fontFamily);
                        setProp({ fontFamily });
                      }}
                    />
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
                          <Icon name={`align${a[0].toUpperCase()}${a.slice(1)}`} size={16} />
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* a photo's colors are its pixels; its fill isn't one of them */}
                {!(active instanceof FabricImage) && <CreateColors
                  key={colorObjectKey(active)}
                  onPickFromPage={pickFromPage}
                  object={active}
                  onEdit={(color) => setColorEditor({ mode: "object", color })}
                  onChange={() => {
                    active.set("dirty", true);
                    render();
                  }}
                />}

                {isLine && (
                  <>
                    <p className="cp-label">Line style</p>
                    <div className="pp-line-styles" role="group" aria-label="Line style">
                      {["solid", "dashed", "dotted"].map((style) => (
                        <button
                          key={style}
                          type="button"
                          className={lineStyle === style ? "on" : ""}
                          title={`${style[0].toUpperCase()}${style.slice(1)} line`}
                          aria-label={`${style[0].toUpperCase()}${style.slice(1)} line`}
                          onClick={() => {
                            const unitScale = unit() / 1080;
                            const strokeDashArray = style === "solid"
                              ? null
                              : style === "dashed"
                                ? [12 * unitScale, 8 * unitScale]
                                : [2 * unitScale, 7 * unitScale];
                            setProp({ strokeDashArray });
                          }}
                        >
                          <span className={`pp-line-sample ${style}`} />
                        </button>
                      ))}
                    </div>
                    <label className="pp-row">
                      <span>Rounded ends</span>
                      <input
                        type="checkbox"
                        checked={active.strokeLineCap === "round"}
                        onChange={(e) => setProp({ strokeLineCap: e.target.checked ? "round" : "butt" })}
                      />
                    </label>
                  </>
                )}

                <p className="cp-label">Size</p>
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
                      <Icon name={lockRatio ? "lock" : "unlock"} size={15} />
                    </button>
                  )}
                </div>
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

                {(isSelection || isGroup) && (
                  <div className="pp-grid">
                    {isSelection && <button onClick={group}><Icon name="group" size={16} /><span>Group</span></button>}
                    {isGroup && <button onClick={ungroup}><Icon name="ungroup" size={16} /><span>Ungroup</span></button>}
                  </div>
                )}

                {/* layer order, flip and rotation, folded away until needed;
                    duplicate, lock and delete are on the toolbar by the element */}
                <details className="pp-more">
                  <summary>Position</summary>
                  <div className="pp-grid">
                    <button onClick={() => arrange("front")}><Icon name="front" size={16} /><span>To front</span></button>
                    <button onClick={() => arrange("back")}><Icon name="back" size={16} /><span>To back</span></button>
                    <button onClick={() => arrange("forward")}><Icon name="forward" size={16} /><span>Forward</span></button>
                    <button onClick={() => arrange("backward")}><Icon name="backward" size={16} /><span>Backward</span></button>
                    <button onClick={() => setProp({ flipX: !active.flipX })}><Icon name="flipH" size={16} /><span>Flip horizontal</span></button>
                    <button onClick={() => setProp({ flipY: !active.flipY })}><Icon name="flipV" size={16} /><span>Flip vertical</span></button>
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
                </details>
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
              <button className="ct-btn" onClick={() => { setShowNew(false); openTab("templates"); }}>
                Start from a template
              </button>
              <button className="ct-btn" onClick={() => setShowNew(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showPublish && (
        <PublishTemplate
          getDesign={() => ({ ...boardRef.current, pages: currentPages() })}
          defaultTitle={name}
          onClose={() => {
            setShowPublish(false);
            fetchTemplates().then(setDbTemplates).catch(() => {});
          }}
        />
      )}
    </section>
  );
}

export default Create;
