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
  Shadow,
  Textbox,
  Triangle,
  FixedLayout,
  LayoutManager,
  Point,
  loadSVGFromString,
  util,
} from "fabric";
import Icon from "./CreateIcons";
import ElementsPanel, { PremiumMark } from "./CreateElements";
import BackgroundPanel from "./CreateBackground";
import CreateSearch from "./CreateSearch";
import { SearchBox } from "./CreateElements";
import TemplateThumb from "../../components/TemplateThumb";
import { elements as libraryElements } from "../../data/elementsData";
import { basicIcons } from "./basicIcons";
import { artboardPresets, photoFrames, shapes, svgDataUrl, textPresets } from "./createLibrary";
import { loadFont, loadFontsOf, loadSiteFonts } from "./createFonts";
import FontPicker from "./FontPicker";
import { pageThumbs } from "./pageThumbs";
import CreateShapeToolbar from "./CreateShapeToolbar";
import "./createHandles";
import { regularPolygonPath } from "./shapePath";
import CreateColors, { CreateColorPanel } from "./CreateColors";
import { colorObjectKey, documentColorsOf, toHex } from "./colorTools";
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
import { fetchTemplates, updateTemplate } from "./templatePublish";
import { clearTemplateEdit, peekTemplateEdit } from "../../lib/templateEdit";
import { fetchIconCatalog, fetchPublished, toCreatePart, toVector } from "../../lib/catalog";
import { askLogin } from "../../lib/authGate";
import { aiReady } from "../../lib/ai";
import { MODELS, removeBackground, upscale } from "../../lib/aiLocal";
import { checkCutout, countCutout, cutoutQuota as fetchCutoutQuota } from "../../lib/toolQuota";
import NumberInput from "../../components/NumberInput";
import { fetchMembership } from "../../lib/billing";
import { emptyKit, fetchBrandKit, saveBrandKit } from "../../lib/brandKit";
import CreateBrand from "./CreateBrand";

const PANEL_KEY = "kd-create-panel";
const PAGE_KEY = "kd-create-page";
const STRIP_KEY = "kd-create-page-strip";
const PROPS_KEY = "kd-create-props";
// zoom slider range, in percent
const ZOOM_MIN = 10;
const ZOOM_MAX = 300;
// height of the page bar above the artboard and Add page below it
const PAGE_CHROME = 96;
const DRAG_TYPE = "application/x-kd-item";
const UNTITLED = "Untitled design";

// icons, vectors and footage live inside Elements, as Canva groups them
const tabs = ["templates", "elements", "background", "text", "brand", "uploads", "layers", "projects", "ai"];
// the tabs that browse the library, under the one search box
const SEARCH_TABS = ["templates", "elements", "background"];
const tabLabel = (t) => (t === "ai" ? "AI" : t[0].toUpperCase() + t.slice(1));

const exportFormats = [
  ["png", "PNG", "High quality image"],
  ["jpg", "JPG", "Smaller file size"],
  ["svg", "SVG", "Scalable vector"],
  ["pdf", "PDF", "Every page, print quality"],
];

const isLocked = (obj) => Boolean(obj?.lockMovementX);
// saved with a design, so a locked element stays locked after undo or reload
// saved with each object: its locks, and a basic shape's sides and corner
const LOCK_PROPS = ["lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls", "kdShape", "kdFrame", "kdPremium"];

// Premium items in a saved page (inside groups too), and the page without them
const countPremium = (objects = []) =>
  objects.reduce((n, o) => n + (o.kdPremium ? 1 : countPremium(o.objects)), 0);
const withoutPremium = (objects = []) =>
  objects.filter((o) => !o.kdPremium).map((o) => (o.objects ? { ...o, objects: withoutPremium(o.objects) } : o));

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
      // AI designs may add opacity, a turn and an outline to any part
      const look = {
        opacity: el.opacity ?? 1,
        angle: el.angle || 0,
        stroke: el.strokeWidth ? el.stroke : null,
        strokeWidth: el.strokeWidth || 0,
      };
      if (el.type === "rect") {
        return new Rect({ left: el.x, top: el.y, width: el.w, height: el.h, rx: el.r || 0, ry: el.r || 0, fill: el.fill, ...look });
      }
      if (el.type === "circle") {
        return new Circle({ left: el.x, top: el.y, radius: el.r, fill: el.fill, ...look });
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
        fontStyle: el.italic ? "italic" : "normal",
        lineHeight: el.lineHeight || 1.16,
        // letter spacing in px; Fabric counts it in thousandths of an em
        charSpacing: el.letterSpacing ? Math.round((el.letterSpacing / el.size) * 1000) : 0,
        opacity: el.opacity ?? 1,
        angle: el.angle || 0,
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
  // the file picker behind a photo frame's Add photo / Replace photo
  const frameInput = useRef(null);

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
  // the properties panel on the right hides the same way
  const [propsOpen, setPropsOpen] = useState(() => {
    try {
      return localStorage.getItem(PROPS_KEY) !== "closed";
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
  // the Resize window: the size picked in it ({ w, h, label }), and whether
  // the pages are being redone
  const [resize, setResize] = useState(null);
  const [resizing, setResizing] = useState(false);
  // where a resize is: "pages", "ai", "apply"; and when it started, for the clock
  const [resizeStage, setResizeStage] = useState(null);
  const [resizeSeconds, setResizeSeconds] = useState(0);
  // admins can let the AI rearrange the layout for the new size (trial);
  // when it fails, a short note under the artboard size says so (its tokens
  // and cost are in ai_generations)
  const [resizeWithAi, setResizeWithAi] = useState(true);
  const [aiResizeNote, setAiResizeNote] = useState(null);
  const [lockRatio, setLockRatio] = useState(true);
  const [uploads, setUploads] = useState([]);
  const [name, setName] = useState(opening.name);
  const [menu, setMenu] = useState(null);
  // PNG / JPG export: the size (1x, 2x, 3x) and, for PNG, a see-through
  // background (Premium, as in Canva); exportNote explains a refusal
  const [exportScale, setExportScale] = useState(1);
  const [exportClear, setExportClear] = useState(false);
  const [exportNote, setExportNote] = useState(null);
  const [canPremium, setCanPremium] = useState(false);
  // the member's brand kit (Premium), saved to their account a moment after a change
  const [brandKit, setBrandKit] = useState(emptyKit);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandError, setBrandError] = useState(null);
  const brandTimer = useRef(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchMembership(user.id).then((m) => alive && setCanPremium(Boolean(m?.canUsePremium))).catch(() => {});
    fetchBrandKit(user.id).then((kit) => alive && setBrandKit(kit)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);
  // a PDF being made: 0..1, or null
  const [pdfProgress, setPdfProgress] = useState(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [pageInfo, setPageInfo] = useState({ index: 0, count: 1 });
  // the strip of page pictures under the canvas, open unless closed before
  const [stripOpen, setStripOpen] = useState(() => {
    try {
      return localStorage.getItem(STRIP_KEY) !== "closed";
    } catch {
      return true;
    }
  });
  const [thumbs, setThumbs] = useState([]);
  // a page being dragged in the strip: { from, to } (to = the gap it would land in)
  const [pageDrag, setPageDrag] = useState(null);
  const stripRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  // admins can publish the open design as a template
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  // a published template opened from Admin → Edit design, and how saving it goes
  const [templateEdit, setTemplateEdit] = useState(peekTemplateEdit);
  const [templateSave, setTemplateSave] = useState(null);
  const [aiOperation, setAiOperation] = useState(null);
  const aiBusy = Boolean(aiOperation && !aiOperation.error);
  // Remove background today: { used, limit } (Free 5 a day, Premium no limit)
  const [cutoutQuota, setCutoutQuota] = useState(null);
  // templates published from Create, ahead of the built-in ones
  const [dbTemplates, setDbTemplates] = useState([]);
  // elements and backgrounds uploaded on /admin
  const [dbParts, setDbParts] = useState([]);
  // the one search box; icons and vectors load the first time it's used
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState({ icons: [], vectors: [] });
  const libraryAsked = useRef(false);
  const allDesigns = dbTemplates;
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

  // the color panel, with the colors already used across the whole design
  const openColorEditor = (mode, color) => {
    setColorEditor({ mode, color, documentColors: documentColorsOf(currentPages()) });
    // the color panel lives on the right, so a hidden panel comes back
    if (!propsOpen) showProps(true);
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

  // Moves a page to another place in the design; the open page stays open.
  // to is a gap: 0 before the first page, count after the last.
  const movePage = (from, to) => {
    const p = pagesRef.current;
    const at = to > from ? to - 1 : to;
    if (from === at || at < 0 || at >= p.list.length) return;
    p.list[p.index] = fc.current.toObject(LOCK_PROPS);
    const open = p.list[p.index];
    const [page] = p.list.splice(from, 1);
    p.list.splice(at, 0, page);
    p.index = p.list.indexOf(open);
    syncPages();
    rememberPage(p.index);
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

  // redraws the page pictures once a change is saved (only those that changed)
  const drawThumbs = useEffectEvent(async (isCurrent) => {
    if (!fc.current || !loadedRef.current) return;
    const list = await pageThumbs(currentPages(), boardRef.current);
    if (isCurrent()) setThumbs(list);
  });
  useEffect(() => {
    if (!stripOpen || pageInfo.count < 2 || saveState === "saving") return;
    let current = true;
    const t = setTimeout(() => drawThumbs(() => current), 150);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [stripOpen, saveState, pageInfo, board]);

  // keep the open page in view in the strip. Only the strip scrolls:
  // scrollIntoView would also nudge the editor and the side panels.
  useEffect(() => {
    const strip = stripRef.current;
    const on = strip?.querySelector(".on");
    if (!on) return;
    if (on.offsetLeft < strip.scrollLeft) strip.scrollLeft = on.offsetLeft - 16;
    else if (on.offsetLeft + on.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollLeft = on.offsetLeft + on.offsetWidth - strip.clientWidth + 16;
  }, [pageInfo.index, pageInfo.count, stripOpen]);

  const toggleStrip = () => {
    setStripOpen((open) => {
      try {
        localStorage.setItem(STRIP_KEY, open ? "closed" : "open");
      } catch {
        /* storage unavailable */
      }
      return !open;
    });
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

  const showProps = (open) => {
    setPropsOpen(open);
    try {
      localStorage.setItem(PROPS_KEY, open ? "open" : "closed");
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

  // Every page to a new size. As a copy, the original stays in Projects
  // untouched; in place, it's one undo step.
  const resizeDesign = async ({ w, h, label }, asCopy) => {
    const from = boardRef.current;
    if (resizing || (w === from.w && h === from.h)) return;
    setResizing(true);
    setResizeSeconds(0);
    setResizeStage("pages");
    try {
      const { resizePages, describePages, applyLayout } = await import("./resizeDesign");
      const original = currentPages();
      let pages = await resizePages(original, from, { w, h }, LOCK_PROPS);
      setAiResizeNote(null);
      // the AI re-places each element for the new shape; if it fails, the
      // plain resize above still stands
      if (isAdmin && resizeWithAi) {
        try {
          const { aiResizeLayout } = await import("../../lib/aiTemplate");
          setResizeStage("ai");
          const result = await aiResizeLayout({ from, to: { w, h, label }, pages: await describePages(original, from) });
          setResizeStage("apply");
          pages = await applyLayout(pages, { w, h }, result.pages, LOCK_PROPS);
        } catch (err) {
          setAiResizeNote(err.message);
        }
      }
      const index = pagesRef.current.index;
      setResizeStage("apply");
      if (asCopy) {
        flushSave();
        switchProject(null);
        renameDesign(`${nameRef.current} (${label ?? `${w}×${h}`})`);
      }
      await restore({ w, h, pages }, index);
      if (asCopy) resetHistory();
      else commit();
      setResize(null);
    } catch {
      window.alert("The design couldn't be resized. A picture from another site may be blocking it.");
    } finally {
      setResizing(false);
      setResizeStage(null);
    }
  };

  // the seconds ticking while a resize runs
  useEffect(() => {
    if (!resizing) return;
    const t = setInterval(() => setResizeSeconds((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [resizing]);

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
      // a Premium template's items are marked: free to try, Premium to download
      if (t.license && t.license !== "free") {
        for (const page of snap.pages ?? [snap.json]) {
          for (const o of page?.objects ?? []) o.kdPremium = true;
        }
      }
      renameDesign(t.title[0].toUpperCase() + t.title.slice(1));
      await restore(snap, 0);
      rememberPage(0);
      setShowNew(false);
      resetHistory();
      return;
    }
    // the fonts the scene names (an AI design may pick any of Create's fonts)
    await Promise.all([...new Set(t.scene.elements.filter((el) => el.font).map((el) => el.font))].map(loadFont));
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

  // new text takes the brand fonts when the member has a brand kit:
  // the heading font for bold presets, the body font for the rest
  const addText = async (preset, point) => {
    const k = unit() / 1080;
    const brandFont = canPremium ? (preset.weight >= 600 ? brandKit.headingFont : brandKit.bodyFont) : null;
    const fontFamily = brandFont || "Space Grotesk";
    if (brandFont) await loadFont(brandFont);
    const text = new Textbox(preset.label, {
      width: boardRef.current.w * 0.8,
      fontSize: Math.round(preset.size * k),
      fontWeight: preset.weight,
      fontFamily,
      fill: "#1d1d1d",
    });
    place(text, point);
  };

  /* ---------- editing a published template (admins) ---------- */

  const saveTemplateEdit = async () => {
    if (!templateEdit || templateSave?.busy) return;
    setTemplateSave({ busy: true, step: "Saving" });
    try {
      await updateTemplate(templateEdit, { ...boardRef.current, pages: currentPages() }, (step, p) =>
        setTemplateSave({ busy: true, step: p > 0 && p < 1 ? `${step} ${Math.round(p * 100)}%` : step }),
      );
      setTemplateSave({ done: true });
      fetchTemplates().then(setDbTemplates).catch(() => {});
    } catch (err) {
      setTemplateSave({ error: err.message || "The template couldn't be saved." });
    }
  };

  /* ---------- brand kit ---------- */

  const changeBrandKit = (kit) => {
    setBrandKit(kit);
    setBrandError(null);
    if (!user || !canPremium) return;
    clearTimeout(brandTimer.current);
    setBrandSaving(true);
    brandTimer.current = setTimeout(() => {
      saveBrandKit(user.id, kit)
        .catch(() => setBrandError("Couldn't save the brand kit. Check your connection."))
        .finally(() => setBrandSaving(false));
    }, 600);
  };

  // a brand color paints the selection (every colored part of an icon or
  // group), or the page when nothing is selected
  const applyBrandColor = (color) => {
    const obj = fc.current?.getActiveObject();
    if (!obj) return setBackground(color);
    const parts = obj instanceof Group || obj instanceof ActiveSelection ? obj.getObjects() : [obj];
    const paint = (o) => {
      if (o instanceof Group) return o.getObjects().forEach(paint);
      if (o instanceof FabricImage) return;
      if (o.fill && o.fill !== "transparent" && o.fill !== "none") o.set({ fill: color });
      else if (o.stroke) o.set({ stroke: color });
    };
    parts.forEach(paint);
    obj.set({ dirty: true });
    render();
  };

  const addSvg = async (markup, point, premium = false) => {
    const { objects, options } = await loadSVGFromString(markup);
    const obj = util.groupSVGElements(objects.filter(Boolean), options);
    obj.scaleToWidth(unit() * 0.3);
    obj.kdPremium = premium || undefined;
    place(obj, point);
  };

  // premium: a Premium library item, free to try and Premium to download
  const addImage = async (src, point, premium = false) => {
    const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
    const b = boardRef.current;
    img.scale(Math.min((b.w * 0.5) / img.width, (b.h * 0.5) / img.height));
    img.kdPremium = premium || undefined;
    place(img, point);
  };

  const addItem = ({ kind, id }, point) => {
    if (kind === "shape") return addShape(id, point);
    if (kind === "frame") return addFrame(id, point);
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
      if (el.type !== "svg") return addImage(el.url, point, el.premium);
      return fetch(el.url).then((r) => r.text()).then((markup) => addSvg(markup, point, el.premium));
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

  // today's Remove background allowance, read when the AI tab opens
  useEffect(() => {
    if (tab !== "ai") return;
    let alive = true;
    fetchCutoutQuota().then((q) => alive && setCutoutQuota(q)).catch(() => {});
    return () => { alive = false; };
  }, [tab, user]);

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
      if (operation === "cutout") await checkCutout();
      const response = await fetch(image.getSrc());
      if (!response.ok) throw new Error("Could not read this image. Try uploading it again.");
      const source = await response.blob();
      const input = new File([source], "create-image", { type: source.type || "image/png" });
      const onStep = (step, progress) => setAiOperation({ operation, step, progress });
      const processed = operation === "cutout"
        ? await removeBackground(input, onStep, { cropToSubject: true })
        : await upscale(input, onStep, scale);
      if (operation === "cutout") setCutoutQuota(await countCutout());
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
      setAiOperation({
        operation,
        error: error.message || "The image couldn't be processed. Try again.",
        limit: error.code === "daily_limit",
      });
      if (operation === "cutout") fetchCutoutQuota().then(setCutoutQuota).catch(() => {});
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

  /* ---------- photo frames ---------- */

  // An empty frame is a group: the shape in grey and a small picture sign.
  // A filled one is a group holding the photo, cut to the shape (clipPath).
  // kdFrame (saved with the design) says which shape it is.
  const addFrame = (id, point) => {
    const f = photoFrames.find((x) => x.id === id);
    if (!f) return;
    const k = (unit() * 0.45) / Math.max(f.w, f.h);
    const w = f.w * k;
    const h = f.h * k;
    const shape = new Path(f.path, { fill: "#d4d8de", strokeWidth: 0, scaleX: k, scaleY: k, left: 0, top: 0 });
    const m = w / 100;
    const sign = [
      new Path("M0 18 L8 8 L13 13 L17 9 L24 18Z", { fill: "#8a929c", strokeWidth: 0, scaleX: m * 1.4, scaleY: m * 1.4, left: w / 2 - 17 * m, top: h / 2 - 12 * m }),
      new Circle({ radius: 3 * m * 1.4, fill: "#8a929c", left: w / 2 + 3 * m, top: h / 2 - 14 * m }),
    ];
    const frame = new Group([shape, ...sign], { kdFrame: id });
    place(frame, point);
  };

  // the frame under a point on the page, topmost first
  const frameAt = (point) =>
    [...fc.current.getObjects()].reverse().find((o) => o.kdFrame && o.visible && o.containsPoint(point));

  // puts a photo into a frame: it covers the frame's box and is cut to its shape
  const fillFrame = async (frame, src) => {
    const c = fc.current;
    const f = photoFrames.find((x) => x.id === frame.kdFrame);
    if (!f) return;
    const w = frame.width;
    const h = frame.height;
    const k = Math.min(w / f.w, h / f.h);
    const img = await imageCover(src, w, h);
    img.set({ left: 0, top: 0 });
    // a fixed layout: zooming or moving the photo inside never resizes the frame
    const filled = new Group([img], { kdFrame: frame.kdFrame, layoutManager: new LayoutManager(new FixedLayout()) });
    filled.clipPath = new Path(f.path, { scaleX: k, scaleY: k, left: -w / 2, top: -h / 2 });
    filled.set({
      left: frame.left, top: frame.top, scaleX: frame.scaleX, scaleY: frame.scaleY,
      angle: frame.angle, flipX: frame.flipX, flipY: frame.flipY, opacity: frame.opacity, shadow: frame.shadow,
    });
    const index = c.getObjects().indexOf(frame);
    c.remove(frame);
    c.insertAt(index, filled);
    filled.setCoords();
    c.setActiveObject(filled);
    setActive(filled);
    render();
  };

  // the photo inside a filled frame, or null
  const framePhoto = (frame) => {
    const inner = frame?.kdFrame && frame.getObjects?.()[0];
    return inner instanceof FabricImage ? inner : null;
  };

  // the photo always covers its frame: never smaller, never pulled off an edge
  // (the photo's left/top sit in the frame's plane, around its center)
  const coverFrame = (frame, img) => {
    const w = frame.width;
    const h = frame.height;
    const s = Math.max(img.scaleX, w / img.width, h / img.height);
    const iw = img.width * s;
    const ih = img.height * s;
    img.set({
      scaleX: s,
      scaleY: s,
      left: Math.min(-w / 2, Math.max(w / 2 - iw, img.left)),
      top: Math.min(-h / 2, Math.max(h / 2 - ih, img.top)),
    });
  };

  // Adjust photo (double-click a filled frame): the whole photo shows faded
  // behind the frame as a handle to drag and resize; the frame shows the result.
  const frameAdjust = useRef(null);
  // the frame whose photo is being adjusted, or null
  const [adjusting, setAdjusting] = useState(null);

  const placeGhost = (img, ghost) => {
    // the photo's full transform on the page (its own, then the frame's)
    const d = util.qrDecompose(img.calcTransformMatrix());
    ghost.set({ scaleX: d.scaleX, scaleY: d.scaleY, angle: d.angle, skewX: 0, skewY: 0 });
    ghost.setPositionByOrigin(new Point(d.translateX, d.translateY), "center", "center");
    ghost.setCoords();
  };

  const startFrameAdjust = async (frame) => {
    const img = framePhoto(frame);
    if (!img || frameAdjust.current) return;
    const c = fc.current;
    const ghost = await img.clone();
    ghost.set({
      opacity: 0.45,
      lockRotation: true,
      lockSkewingX: true,
      lockSkewingY: true,
      excludeFromExport: true,
      kdGhost: true,
    });
    ghost.setControlsVisibility({ mtr: false, ml: false, mr: false, mt: false, mb: false });
    placeGhost(img, ghost);
    c.insertAt(c.getObjects().indexOf(frame), ghost);
    frame.set({ evented: false, selectable: false });
    frameAdjust.current = { frame, img, ghost };
    setAdjusting(frame);
    c.setActiveObject(ghost);
    setActive(ghost);
    c.requestRenderAll();
  };

  // moving or resizing the faded photo moves the photo inside the frame
  const syncFrameAdjust = () => {
    const a = frameAdjust.current;
    if (!a) return;
    const m = util.multiplyTransformMatrices(util.invertTransform(a.frame.calcTransformMatrix()), a.ghost.calcTransformMatrix());
    const d = util.qrDecompose(m);
    a.img.set({ scaleX: d.scaleX, scaleY: d.scaleY });
    a.img.setPositionByOrigin(new Point(d.translateX, d.translateY), "center", "center");
    coverFrame(a.frame, a.img);
    placeGhost(a.img, a.ghost);
    a.frame.set({ dirty: true });
    fc.current.requestRenderAll();
  };

  const endFrameAdjust = () => {
    const a = frameAdjust.current;
    if (!a) return;
    frameAdjust.current = null;
    const c = fc.current;
    c.remove(a.ghost);
    a.frame.set({ evented: true, selectable: true, dirty: true });
    setAdjusting(null);
    c.setActiveObject(a.frame);
    setActive(a.frame);
    render();
  };

  // a soft drop shadow for a frame, 0 to 100, sized to the frame
  const frameShadowAmount = (obj) => {
    if (!obj?.shadow) return 0;
    const size = Math.min(obj.width * obj.scaleX, obj.height * obj.scaleY) || 1;
    return Math.round(Math.min(100, (obj.shadow.blur / size) * 400));
  };
  // (works while adjusting the photo too, when the faded photo is selected)
  const setFrameShadow = (frame, amount) => {
    const size = Math.min(frame.width * frame.scaleX, frame.height * frame.scaleY);
    frame.set({
      shadow: amount > 0
        ? new Shadow({ color: "rgba(0,0,0,0.35)", blur: (size * amount) / 400, offsetX: 0, offsetY: (size * amount) / 1200 })
        : null,
      dirty: true,
    });
    render();
  };

  // a picture dropped or picked for a frame: its address, or null for SVGs
  const pictureOf = async ({ kind, id }) => {
    if (kind === "upload") {
      const u = uploads.find((x) => x.id === id);
      return u && u.type !== "svg" ? u.data : null;
    }
    if (kind === "vector") {
      const v = library.vectors.find((x) => x.id === id);
      return v ? v.previewImage ?? v.image : null;
    }
    if (kind === "element") {
      const el = dbElements.find((e) => e.id === id) ?? libraryElements.find((e) => e.id === id);
      return el?.url && !/\.svg(\?|$)/i.test(el.url) ? el.url : null;
    }
    return null;
  };

  const pickFramePhoto = async (file) => {
    const frame = fc.current.getActiveObject();
    if (!file || !frame?.kdFrame) return;
    const u = await readFile(file);
    if (u.type === "svg") return;
    setUploads((list) => [u, ...list]);
    await fillFrame(frame, u.data);
  };

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

  const onDrop = async (e) => {
    e.preventDefault();
    const point = fc.current.getScenePoint(e.nativeEvent);
    const data = e.dataTransfer.getData(DRAG_TYPE);
    const files = [...e.dataTransfer.files];
    // a photo dropped on a frame goes into the frame
    const frame = frameAt(point);
    if (frame) {
      const photo = files.find((f) => /png|jpe?g|webp/i.test(f.type || f.name));
      if (photo) {
        const u = await readFile(photo);
        setUploads((list) => [u, ...list]);
        return fillFrame(frame, u.data);
      }
      if (data) {
        const src = await pictureOf(JSON.parse(data));
        if (src) return fillFrame(frame, src);
      }
    }
    if (files.length) return handleFiles(e.dataTransfer.files, point);
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
    const clone = await obj.clone(LOCK_PROPS);
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

  /* ---------- clipboard, select all, nudge ---------- */

  // what Ctrl+C took: a copy of the selection, the page it came from, and how
  // many times it has been pasted (each paste on that page lands a step lower)
  const clipboard = useRef(null);

  const copy = async () => {
    const obj = fc.current.getActiveObject();
    if (!obj) return false;
    // the locks and a basic shape's sides and corner come along
    clipboard.current = { object: await obj.clone(LOCK_PROPS), page: pagesRef.current.index, pasted: 0 };
    return true;
  };

  const paste = async () => {
    const held = clipboard.current;
    if (!held) return;
    const c = fc.current;
    const clone = await held.object.clone(LOCK_PROPS);
    // on another page it keeps its place, as in Figma; on its own page it steps aside
    const samePage = held.page === pagesRef.current.index;
    const step = samePage ? 30 * ++held.pasted : 0;
    c.discardActiveObject();
    clone.set({ left: clone.left + step, top: clone.top + step });
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

  // after a cut, the first paste puts it back where it was
  const cut = async () => {
    if (!(await copy())) return;
    clipboard.current.pasted = -1;
    remove();
  };

  // every element that can be picked: not hidden, not the crop frame
  const selectAll = () => {
    const c = fc.current;
    const objects = c.getObjects().filter((o) => o.visible && o.selectable !== false && !o.isCropFrame);
    if (!objects.length) return;
    c.discardActiveObject();
    const selection = objects.length === 1 ? objects[0] : new ActiveSelection(objects, { canvas: c });
    c.setActiveObject(selection);
    setActive(selection);
    c.requestRenderAll();
    refresh();
  };

  // arrow keys move the selection 1 px, or 10 px with Shift; locked ones stay
  const nudge = (dx, dy) => {
    const obj = fc.current.getActiveObject();
    if (!obj || isLocked(obj)) return;
    obj.set({ left: obj.left + dx, top: obj.top + dy });
    obj.setCoords();
    render();
  };

  /* ---------- align & distribute ---------- */

  // One element lines up with the page; several line up with each other
  // (the box around them). edge: center (both ways), left, centerH, right,
  // top, centerV, bottom.
  // Locked elements stay put.
  const alignTo = (edge) => {
    const c = fc.current;
    const sel = c.getActiveObject();
    if (!sel) return;
    const many = sel instanceof ActiveSelection;
    const objects = many ? sel.getObjects() : [sel];
    if (many) c.discardActiveObject();
    const boxes = objects.map((o) => o.getBoundingRect());
    const area = many
      ? (() => {
          const left = Math.min(...boxes.map((b) => b.left));
          const top = Math.min(...boxes.map((b) => b.top));
          return {
            left,
            top,
            right: Math.max(...boxes.map((b) => b.left + b.width)),
            bottom: Math.max(...boxes.map((b) => b.top + b.height)),
          };
        })()
      : { left: 0, top: 0, right: boardRef.current.w, bottom: boardRef.current.h };
    objects.forEach((o, i) => {
      if (isLocked(o)) return;
      const b = boxes[i];
      const dx = {
        left: area.left - b.left,
        center: (area.left + area.right) / 2 - (b.left + b.width / 2),
        centerH: (area.left + area.right) / 2 - (b.left + b.width / 2),
        right: area.right - (b.left + b.width),
      }[edge] ?? 0;
      const dy = {
        top: area.top - b.top,
        center: (area.top + area.bottom) / 2 - (b.top + b.height / 2),
        centerV: (area.top + area.bottom) / 2 - (b.top + b.height / 2),
        bottom: area.bottom - (b.top + b.height),
      }[edge] ?? 0;
      o.set({ left: o.left + dx, top: o.top + dy });
      o.setCoords();
    });
    reselect(objects, many);
  };

  // equal gaps between three or more elements, keeping the outer two in place
  const distribute = (axis) => {
    const c = fc.current;
    const sel = c.getActiveObject();
    if (!(sel instanceof ActiveSelection) || sel.size() < 3) return;
    const objects = sel.getObjects();
    c.discardActiveObject();
    const start = axis === "h" ? "left" : "top";
    const size = axis === "h" ? "width" : "height";
    const items = objects
      .map((o) => ({ o, b: o.getBoundingRect() }))
      .sort((a, b) => a.b[start] - b.b[start]);
    const first = items[0].b;
    const last = items[items.length - 1].b;
    const used = items.reduce((sum, { b }) => sum + b[size], 0);
    const gap = (last[start] + last[size] - first[start] - used) / (items.length - 1);
    let at = first[start] + first[size] + gap;
    items.slice(1, -1).forEach(({ o, b }) => {
      if (!isLocked(o)) {
        o.set({ [start]: o[start] + (at - b[start]) });
        o.setCoords();
      }
      at += b[size] + gap;
    });
    reselect(objects, true);
  };

  // picks the same elements again after moving them
  const reselect = (objects, many) => {
    const c = fc.current;
    const next = many ? new ActiveSelection(objects, { canvas: c }) : objects[0];
    c.setActiveObject(next);
    setActive(next);
    render();
  };

  /* ---------- text spacing, case and shadow ---------- */

  // UPPER, lower or Title Case: the words themselves change (one undo step)
  const setCase = (kind) => {
    const text = active.text;
    const next = kind === "upper" ? text.toUpperCase()
      : kind === "lower" ? text.toLowerCase()
        : text.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, gap, letter) => gap + letter.toUpperCase());
    setProp({ text: next });
  };

  // a soft drop shadow, 0 (none) to 100, sized to the text so it looks the
  // same on a small caption and a big headline
  const shadowAmount = (obj) =>
    obj?.shadow ? Math.round(Math.min(100, (obj.shadow.blur / Math.max(1, obj.fontSize)) * 250)) : 0;
  const setShadow = (amount) => {
    const size = active.fontSize || 40;
    setProp({
      shadow: amount > 0
        ? new Shadow({ color: "rgba(0,0,0,0.35)", blur: (size * amount) / 250, offsetX: 0, offsetY: (size * amount) / 800 })
        : null,
    });
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

  // Background photo out to a normal picture at the back, to move, crop or
  // turn it (Canva's "Detach image from background")
  const detachBackground = async () => {
    const c = fc.current;
    const bg = c.backgroundImage;
    if (!bg) return;
    const img = await bg.clone();
    img.set({ left: 0, top: 0 });
    bgRequest.current++;
    c.backgroundImage = undefined;
    setBgPhoto(null);
    c.insertAt(0, img);
    c.setActiveObject(img);
    setActive(img);
    render();
  };

  // the selected picture becomes the page's background: it fills the page and
  // can't be moved by accident any more (Canva's "Set image as background")
  const setAsBackground = async () => {
    const c = fc.current;
    const obj = c.getActiveObject();
    if (!(obj instanceof FabricImage)) return;
    const src = obj.getSrc();
    c.discardActiveObject();
    c.remove(obj);
    setActive(null);
    await setBackgroundPhoto(src);
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
      {t.license && t.license !== "free" && <PremiumMark />}
    </button>
  );

  // Premium items on every page (the open one as it is now)
  const premiumCount = () => currentPages().reduce((n, page) => n + countPremium(page?.objects), 0);

  // takes the Premium items out of every page, so a free account can download
  const removePremium = async () => {
    const p = pagesRef.current;
    const pages = currentPages().map((page) => page && { ...page, objects: withoutPremium(page.objects) });
    await restore({ w: boardRef.current.w, h: boardRef.current.h, pages }, p.index);
    setExportNote(null);
    commit();
  };

  const exportFile = (format) => {
    // Premium items can be tried freely; downloading them needs Premium
    const premium = canPremium ? 0 : premiumCount();
    if (premium > 0) {
      setExportNote({ premium });
      setMenu("download");
      return;
    }
    // the design is autosaved on this device, so nothing is lost meanwhile
    if (!user) {
      askLogin("design");
      return;
    }
    // a see-through background is a Premium export
    if (format === "png" && exportClear && !canPremium) {
      setExportNote("A transparent background is part of Premium. The PNG wasn't made.");
      setMenu("download");
      return;
    }
    const c = fc.current;
    const b = boardRef.current;
    c.discardActiveObject();
    c.renderAll();
    setActive(null);

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const save = (href, file) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = file;
      a.click();
    };

    // every page in one file; the open page's latest edits included
    if (format === "pdf") {
      if (pdfProgress !== null) return;
      const pages = currentPages();
      setPdfProgress(0);
      import("./exportPdf")
        .then(({ buildPdf }) => buildPdf(pages, b, setPdfProgress))
        .then((blob) => {
          const href = URL.createObjectURL(blob);
          save(href, `${slug || "khulqidesign"}-${b.w}x${b.h}.pdf`);
          setTimeout(() => URL.revokeObjectURL(href), 10000);
        })
        .catch(() => window.alert("The PDF couldn't be made. A picture from another site may be blocking it; try removing it."))
        .finally(() => setPdfProgress(null));
      return;
    }

    let url;
    if (format === "svg") {
      const markup = c.toSVG({ width: b.w, height: b.h, viewBox: { x: 0, y: 0, width: b.w, height: b.h } });
      url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    } else {
      // the page's background color is left out for a transparent PNG, then put back
      const clear = format === "png" && exportClear;
      const color = c.backgroundColor;
      if (clear) c.backgroundColor = null;
      try {
        url = c.toDataURL({ format: format === "jpg" ? "jpeg" : "png", quality: 0.92, multiplier: exportScale / c.getZoom() });
      } finally {
        if (clear) {
          c.backgroundColor = color;
          c.requestRenderAll();
        }
      }
    }

    const { index, list } = pagesRef.current;
    const pageTag = list.length > 1 ? `-page-${index + 1}` : "";
    // a 2x or 3x picture says so in its name, as designers name retina files
    const scaleTag = format !== "svg" && exportScale > 1 ? `@${exportScale}x` : "";
    save(url, `${slug || "khulqidesign"}-${b.w}x${b.h}${pageTag}${scaleTag}.${format}`);
  };

  /* ---------- canvas lifecycle ---------- */

  const syncSelection = useEffectEvent(() => {
    // picking anything else (or nothing) ends Adjust photo
    if (frameAdjust.current && fc.current.getActiveObject() !== frameAdjust.current.ghost) {
      endFrameAdjust();
      return;
    }
    setActive(fc.current.getActiveObject() || null);
    refresh();
  });

  const onDoubleClick = useEffectEvent(({ target }) => {
    if (framePhoto(target)) startFrameAdjust(target);
    else if (target instanceof FabricImage && !target.kdGhost) startCrop();
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
  const onTransform = useEffectEvent((opt) => {
    if (opt?.target?.kdGhost) syncFrameAdjust();
    setDragging(true);
  });
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
    // Admin → Edit design: the published template opens as its own project
    if (templateEdit && !draft) {
      await openTemplate({ title: templateEdit.title, designUrl: templateEdit.designUrl }, false, true);
      clearTemplateEdit();
      loadedRef.current = true;
      return;
    }
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
    } else if (mod && e.key.toLowerCase() === "c" && obj) {
      e.preventDefault();
      copy();
    } else if (mod && e.key.toLowerCase() === "x" && obj) {
      e.preventDefault();
      cut();
    } else if (mod && e.key.toLowerCase() === "v" && clipboard.current) {
      // without our own copy, the browser's paste is left alone
      e.preventDefault();
      paste();
    } else if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      selectAll();
    } else if (e.key.startsWith("Arrow") && obj && !mod) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      nudge(dx, dy);
    } else if (e.key === "Escape" && frameAdjust.current) {
      endFrameAdjust();
    } else if (e.key === "Escape" && obj) {
      fc.current.discardActiveObject();
      fc.current.requestRenderAll();
      setActive(null);
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
  // a photo frame is a group too, but splitting it would lose the cut-out
  const isGroup = active instanceof Group && !isSelection && !active.kdFrame;
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
      {/* Admin → Edit design: this design is a published template */}
      {templateEdit && isAdmin && (
        <div className="ct-template-edit" role="status">
          <span className="ct-template-edit-tag">Editing template</span>
          <strong>{templateEdit.title}</strong>
          <span className="ct-template-edit-code">{templateEdit.code}</span>
          <span className="ct-template-edit-state">
            {templateSave?.busy
              ? `${templateSave.step}…`
              : templateSave?.done
                ? "Updated on the site"
                : templateSave?.error ?? "Change the size, layout or anything else, then update."}
          </span>
          <button className="ct-btn primary" onClick={saveTemplateEdit} disabled={Boolean(templateSave?.busy)}>
            Update template
          </button>
          <button className="ct-btn" onClick={() => setTemplateEdit(null)} disabled={Boolean(templateSave?.busy)}>
            Done
          </button>
        </div>
      )}
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
              <Icon name="download" />
              {pdfProgress === null ? "Download" : `PDF ${Math.round(pdfProgress * 100)}%`}
              <Icon name="chevron" size={14} />
            </button>
            {menu === "download" && (
              <div className="ct-dropdown is-right">
                {/* size and background for PNG and JPG */}
                <div className="ct-export-opts">
                  <div className="ct-export-row">
                    <span>Size</span>
                    <div className="pp-seg" role="group" aria-label="Export size">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          className={exportScale === n ? "on" : ""}
                          onClick={() => setExportScale(n)}
                          // Safari can't draw pictures much past 16 million pixels
                          disabled={board.w * board.h * n * n > 16_000_000}
                          title={`${board.w * n} × ${board.h * n} px`}
                        >
                          {n}×
                        </button>
                      ))}
                    </div>
                  </div>
                  <small>{board.w * exportScale} × {board.h * exportScale} px (PNG, JPG)</small>
                  <label className="ct-export-clear">
                    <input type="checkbox" checked={exportClear} onChange={(e) => { setExportClear(e.target.checked); setExportNote(null); }} />
                    Transparent background
                    <span className="ct-premium">Premium</span>
                  </label>
                  {exportNote?.premium ? (
                    <div className="ct-premium-note">
                      <p><Icon name="crown" size={13} /> {exportNote.premium} Premium item{exportNote.premium === 1 ? "" : "s"} used</p>
                      <div>
                        <a href="/pricing" className="is-gold">Upgrade</a>
                        <button onClick={removePremium} title="Take the Premium items out of every page">Remove</button>
                      </div>
                    </div>
                  ) : exportNote && (
                    <p className="ct-export-note">
                      {exportNote} <a href="/pricing">See plans</a>
                    </p>
                  )}
                </div>
                <hr />
                {exportFormats.map(([format, label, hint]) => (
                  <button key={format} onClick={() => { setMenu(null); setExportNote(null); exportFile(format); }}>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {menu && <div className="ct-backdrop" onClick={() => setMenu(null)} />}

        <div className={`create-body ${panelOpen ? "" : "panel-closed"} ${propsOpen ? "" : "props-closed"}`}>
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

            {!searching && tab === "templates" && <div className="cp-masonry">{allDesigns.map(templateTile)}</div>}

            {!searching && tab === "elements" && <ElementsPanel dragItem={dragItem} uploaded={dbElements} />}
            {!searching && tab === "background" && (
              <BackgroundPanel
                color={toHex(bg)}
                photo={bgPhoto}
                photos={dbBackgrounds}
                onColor={setBackground}
                onEditColor={() => openColorEditor("background", toHex(bg))}
                dragItem={dragItem}
              />
            )}

            {tab === "ai" && (
              <AiPanel
                aiReady={aiReady}
                hasSelectedImage={active instanceof FabricImage}
                operation={aiOperation}
                models={MODELS}
                cutoutQuota={cutoutQuota}
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

            {tab === "brand" && (
              <CreateBrand
                kit={brandKit}
                onChange={changeBrandKit}
                canUse={canPremium}
                signedIn={Boolean(user)}
                onLogin={() => askLogin("design")}
                onUseColor={applyBrandColor}
                onUseLogo={(src) => (src.startsWith("data:image/svg") ? addSvg(atob(src.split(",")[1]), undefined) : addImage(src))}
                saving={brandSaving}
                error={brandError}
              />
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
          <button
            className="props-toggle"
            onClick={() => showProps(!propsOpen)}
            aria-label={propsOpen ? "Hide properties" : "Show properties"}
            aria-expanded={propsOpen}
            title={propsOpen ? "Hide properties" : "Show properties"}
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
                    <>
                      {/* a ring in the color under the pointer, as in Figma */}
                      <span className="ct-picker-ring" style={{ left: picker.x, top: picker.y, borderColor: picker.hex }} />
                      <span className="ct-picker-chip" style={{ left: picker.x, top: picker.y }}>{picker.hex.toUpperCase()}</span>
                    </>
                  )}
                </div>
              )}

              {floatPos && cropping && (
                <div className="ct-float ct-float-crop" style={floatPos}>
                  <button onClick={() => finishCrop(false)}>Cancel</button>
                  <button className="on" onClick={() => finishCrop(true)}>Done</button>
                </div>
              )}

              {floatPos && adjusting && (
                <div className="ct-float ct-float-crop" style={floatPos}>
                  <button className="on" onClick={endFrameAdjust}>Done</button>
                </div>
              )}

              {floatPos && !cropping && !adjusting && (
                <div className="ct-float" style={floatPos}>
                  {active?.kdFrame && !locked && (
                    <button onClick={() => frameInput.current?.click()} title={active.getObjects?.()[0] instanceof FabricImage ? "Replace photo" : "Add photo"}>
                      <Icon name="uploads" />
                    </button>
                  )}
                  {framePhoto(active) && !locked && (
                    <button onClick={() => startFrameAdjust(active)} title="Adjust photo (double-click)"><Icon name="crop" /></button>
                  )}
                  {active instanceof FabricImage && !locked && (
                    <>
                      <button onClick={startCrop} title="Crop (double-click)"><Icon name="crop" /></button>
                      <button onClick={setAsBackground} title="Set as background"><Icon name="background" /></button>
                    </>
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

          {/* every page as a small picture: click one to open it */}
          {stripOpen && pageInfo.count > 1 && (
            <div className="create-strip" ref={stripRef} inert={cropping} role="tablist" aria-label="Pages">
              {Array.from({ length: pageInfo.count }, (_, i) => (
                <button
                  key={i}
                  className={[
                    "cs-page",
                    i === pageInfo.index ? "on" : "",
                    pageDrag?.from === i ? "dragging" : "",
                    pageDrag && pageDrag.to === i && pageDrag.from !== i && pageDrag.from !== i - 1 ? "drop-before" : "",
                    pageDrag && pageDrag.to === i + 1 && i === pageInfo.count - 1 && pageDrag.from !== i ? "drop-after" : "",
                  ].join(" ")}
                  style={{ aspectRatio: `${board.w} / ${board.h}` }}
                  onClick={() => goToPage(i)}
                  role="tab"
                  aria-selected={i === pageInfo.index}
                  aria-label={`Page ${i + 1}. Drag, or Alt and an arrow key, to move it`}
                  title="Drag to reorder"
                  // drag a page to a new place; the line shows where it lands
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/x-kd-page", String(i));
                    setPageDrag({ from: i, to: i });
                  }}
                  onDragOver={(e) => {
                    if (!pageDrag) return;
                    e.preventDefault();
                    const r = e.currentTarget.getBoundingClientRect();
                    const to = e.clientX < r.left + r.width / 2 ? i : i + 1;
                    if (to !== pageDrag.to) setPageDrag({ ...pageDrag, to });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (pageDrag) movePage(pageDrag.from, pageDrag.to);
                    setPageDrag(null);
                  }}
                  onDragEnd={() => setPageDrag(null)}
                  // the keyboard way: Alt+Left or Alt+Right
                  onKeyDown={(e) => {
                    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const to = e.key === "ArrowLeft" ? i - 1 : i + 2;
                    if (to < 0 || to > pageInfo.count) return;
                    movePage(i, to);
                    // keep the focus on the page that moved
                    const at = e.key === "ArrowLeft" ? i - 1 : i + 1;
                    requestAnimationFrame(() => stripRef.current?.querySelectorAll(".cs-page")[at]?.focus());
                  }}
                >
                  {thumbs[i] && <img src={thumbs[i]} alt="" draggable="false" />}
                  <span>{i + 1}</span>
                </button>
              ))}
              <button
                className="cs-add"
                style={{ aspectRatio: `${board.w} / ${board.h}` }}
                onClick={() => addPage(false)}
                title="Add page"
                aria-label="Add page"
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          )}

          {/* pages, zoom and full screen, under the canvas as in Canva */}
          <div className="create-bottombar" inert={cropping}>
            <div className="cb-pages">
              {pageInfo.count > 1 && (
                <button
                  className={`cb-strip ${stripOpen ? "on" : ""}`}
                  onClick={toggleStrip}
                  aria-pressed={stripOpen}
                  title={stripOpen ? "Hide pages" : "Show pages"}
                >
                  <Icon name="pages" size={15} /> <span className="cb-strip-label">Pages</span>
                  <Icon name="chevron" size={13} />
                </button>
              )}
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
          <aside className="create-props" inert={!propsOpen || cropping || aiBusy} aria-hidden={!propsOpen}>
            {colorEditor ? (
              <CreateColorPanel
                key={colorEditor.mode === "object" ? colorObjectKey(active) : "background"}
                object={colorEditor.mode === "object" ? active : null}
                initialColor={colorEditor.color}
                mode={colorEditor.mode}
                documentColors={colorEditor.documentColors}
                brandColors={canPremium ? brandKit.colors : []}
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
                <button className="pp-resize" onClick={() => setResize({ w: board.w, h: board.h })}>
                  <Icon name="maximize" size={14} /> Resize design
                </button>
                {aiResizeNote && <p className="pp-ai-note">{aiResizeNote}</p>}
                <div className="pp-row">
                  <span>Background</span>
                  <button
                    className="pp-color-chip pp-background-chip"
                    style={{ backgroundColor: bg }}
                    onClick={() => openColorEditor("background", toHex(bg))}
                    title="Edit background color"
                    aria-label="Edit background color"
                  />
                </div>
                {bgPhoto && (
                  <button className="pp-resize" onClick={detachBackground} title="Make the background photo a picture you can move, crop and resize">
                    <Icon name="unlock" size={14} /> Detach background
                  </button>
                )}
                <p className="cp-hint">Select an element to edit it.</p>
              </>
            ) : (
              <>
                {/* one Frame section: its shadow, and the photo inside; while
                    adjusting, only this shows (Done sits by the frame) */}
                {(adjusting || active.kdFrame) && (
                  <>
                    <p className="cp-label">Frame</p>
                    {/* shadow and Adjust photo share one row */}
                    <div className="pp-type">
                      <label title="Frame shadow (0 to 100)">
                        <Icon name="shadow" size={16} />
                        <NumberInput
                          min="0"
                          max="100"
                          step="5"
                          value={frameShadowAmount(adjusting || active)}
                          onChange={(e) => setFrameShadow(adjusting || active, Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                          aria-label="Frame shadow"
                        />
                      </label>
                      {!adjusting && framePhoto(active) && !locked && (
                        <button className="pp-type-btn" onClick={() => startFrameAdjust(active)} title="Move or zoom the photo inside the frame (double-click)">
                          <Icon name="crop" size={14} /> Adjust photo
                        </button>
                      )}
                    </div>
                    {adjusting && (
                      <p className="cp-hint">Drag the photo to move it, drag a corner to zoom. Press Done when finished.</p>
                    )}
                  </>
                )}
                {!adjusting && (
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
                    {/* size, leading, tracking and shadow: icon and number, as in
                        Illustrator's Character panel; arrow keys step them */}
                    <div className="pp-type">
                      <label title="Font size (px)">
                        <Icon name="fontSize" size={16} />
                        <NumberInput
                          min="1"
                          value={Math.round(active.fontSize)}
                          onChange={(e) => setProp({ fontSize: Math.max(1, Number(e.target.value)) })}
                          aria-label="Font size"
                        />
                      </label>
                      <label title="Line spacing (px between lines)">
                        <Icon name="leading" size={16} />
                        <NumberInput
                          min="1"
                          value={Math.round(active.fontSize * (active.lineHeight || 1.16) * 1.13)}
                          onChange={(e) => {
                            const px = Number(e.target.value);
                            if (px > 0) setProp({ lineHeight: Math.max(0.5, px / (active.fontSize * 1.13)) });
                          }}
                          aria-label="Line spacing"
                        />
                      </label>
                      <label title="Letter spacing (1/1000 em)">
                        <Icon name="tracking" size={16} />
                        <NumberInput
                          step="10"
                          value={active.charSpacing || 0}
                          onChange={(e) => setProp({ charSpacing: Number(e.target.value) || 0 })}
                          aria-label="Letter spacing"
                        />
                      </label>
                      <label title="Shadow (0 to 100)">
                        <Icon name="shadow" size={16} />
                        <NumberInput
                          min="0"
                          max="100"
                          step="5"
                          value={shadowAmount(active)}
                          onChange={(e) => setShadow(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                          aria-label="Shadow"
                        />
                      </label>
                    </div>
                    {/* style, alignment and case as small segmented groups, so
                        they sit in two short rows */}
                    <div className="pp-tools">
                    <div className="pp-seg" role="group" aria-label="Text style">
                      <button
                        title="Bold"
                        className={Number(active.fontWeight) >= 600 || active.fontWeight === "bold" ? "on" : ""}
                        onClick={() => setProp({ fontWeight: Number(active.fontWeight) >= 600 || active.fontWeight === "bold" ? 400 : 700 })}
                      >
                        <b>B</b>
                      </button>
                      <button
                        title="Italic"
                        className={active.fontStyle === "italic" ? "on" : ""}
                        onClick={() => setProp({ fontStyle: active.fontStyle === "italic" ? "normal" : "italic" })}
                      >
                        <i>I</i>
                      </button>
                      <button
                        title="Underline"
                        className={active.underline ? "on" : ""}
                        onClick={() => setProp({ underline: !active.underline })}
                      >
                        <u>U</u>
                      </button>
                    </div>
                    <div className="pp-seg" role="group" aria-label="Text alignment">
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
                    <div className="pp-seg pp-case" role="group" aria-label="Letter case">
                      <button onClick={() => setCase("upper")} title="UPPERCASE">AA</button>
                      <button onClick={() => setCase("lower")} title="lowercase">aa</button>
                      <button onClick={() => setCase("title")} title="Title Case">Aa</button>
                    </div>
                    </div>
                  </>
                )}

                {/* a photo's colors are its pixels; its fill isn't one of them */}
                {!(active instanceof FabricImage) && <CreateColors
                  key={colorObjectKey(active)}
                  onPickFromPage={pickFromPage}
                  object={active}
                  onEdit={(color) => openColorEditor("object", color)}
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

                {/* line up with the page, or with each other when several are picked */}
                <p className="cp-label">{isSelection ? "Align selection" : "Align to page"}</p>
                <div className="pp-align pp-seg" role="group" aria-label="Align">
                  {[
                    ["center", "objCenter", "Align center, horizontally and vertically"],
                    ["left", "objLeft", "Align left"],
                    ["centerH", "objCenterH", "Align center"],
                    ["right", "objRight", "Align right"],
                    ["top", "objTop", "Align top"],
                    ["centerV", "objCenterV", "Align middle"],
                    ["bottom", "objBottom", "Align bottom"],
                  ].map(([edge, icon, label]) => (
                    <button key={edge} onClick={() => alignTo(edge)} title={label} aria-label={label} disabled={locked}>
                      <Icon name={icon} size={16} />
                    </button>
                  ))}
                </div>
                {isSelection && active.size() >= 3 && (
                  <div className="pp-seg pp-dist" role="group" aria-label="Distribute">
                    <button onClick={() => distribute("h")} title="Distribute horizontally" aria-label="Distribute horizontally">
                      <Icon name="distH" size={16} />
                    </button>
                    <button onClick={() => distribute("v")} title="Distribute vertically" aria-label="Distribute vertically">
                      <Icon name="distV" size={16} />
                    </button>
                  </div>
                )}

                <p className="cp-label">Size</p>
                <div className="pp-pair">
                  <label>
                    W
                    <NumberInput
                      className="pp-num"
                      value={Math.round(active.getScaledWidth())}
                      onChange={(e) => setSize("w", e.target.value)}
                    />
                  </label>
                  {!isText && (
                    <label>
                      H
                      <NumberInput
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
                  {/* layer order and flips: an icon and a short name in compact
                      rows, so anyone can tell them apart; rotation is a field */}
                  <div className="pp-list">
                    <button onClick={() => arrange("front")}><Icon name="front" size={15} /><span>To front</span></button>
                    <button onClick={() => arrange("back")}><Icon name="back" size={15} /><span>To back</span></button>
                    <button onClick={() => arrange("forward")}><Icon name="forward" size={15} /><span>Forward</span></button>
                    <button onClick={() => arrange("backward")}><Icon name="backward" size={15} /><span>Backward</span></button>
                    <button className={active.flipX ? "on" : ""} onClick={() => setProp({ flipX: !active.flipX })} title="Flip horizontal">
                      <Icon name="flipH" size={15} /><span>Mirror</span>
                    </button>
                    <button className={active.flipY ? "on" : ""} onClick={() => setProp({ flipY: !active.flipY })} title="Flip vertical">
                      <Icon name="flipV" size={15} /><span>Upside down</span>
                    </button>
                  </div>
                  <div className="pp-type">
                    <label title="Rotation (degrees)">
                      <Icon name="rotate" size={16} />
                      <NumberInput
                        value={Math.round(active.angle)}
                        onChange={(e) => {
                          active.rotate(Number(e.target.value) || 0);
                          active.setCoords();
                          render();
                        }}
                        aria-label="Rotation"
                      />
                    </label>
                  </div>
                </details>
                </>
                )}
              </>
            )}
          </aside>
        </div>
      </div>

      {/* RESIZE: every page to another format, as a copy or in place */}
      {resize && (
        <div className="create-modal-overlay" onClick={(e) => e.target === e.currentTarget && !resizing && setResize(null)}>
          <div className="create-modal" role="dialog" aria-label="Resize design">
            <h2>Resize design</h2>
            <p className="cr-note">
              Every page changes size. The layout scales to fit and stays centered; backgrounds stretch to fill.
            </p>
            <div className="cn-presets">
              {artboardPresets.map((p) => (
                <button
                  key={p.label}
                  className={resize.w === p.w && resize.h === p.h ? "on" : ""}
                  onClick={() => setResize({ w: p.w, h: p.h, label: p.label })}
                  disabled={p.w === board.w && p.h === board.h}
                >
                  <span className="cn-shape">
                    <span style={{ aspectRatio: `${p.w} / ${p.h}` }} />
                  </span>
                  <strong>{p.label}</strong>
                  <small>{p.w === board.w && p.h === board.h ? "Current size" : `${p.ratio} · ${p.w}×${p.h}`}</small>
                </button>
              ))}
            </div>

            <div className="cn-custom">
              <span>Custom size</span>
              <NumberInput
                value={resize.w}
                onChange={(e) => setResize({ w: Number(e.target.value), h: resize.h })}
                aria-label="Width"
              />
              ×
              <NumberInput
                value={resize.h}
                onChange={(e) => setResize({ w: resize.w, h: Number(e.target.value) })}
                aria-label="Height"
              />
              px
            </div>

            {/* what's happening, step by step, while the pages are redone */}
            {resizing && (
              <div className="cr-progress" role="status" aria-live="polite">
                <div className="cr-bar"><span /></div>
                <ol>
                  {[
                    ["pages", "Resizing every page"],
                    ...(isAdmin && resizeWithAi ? [["ai", "AI is rearranging the layout"]] : []),
                    ["apply", "Placing everything on the new pages"],
                  ].map(([id, text], i, all) => {
                    const at = all.findIndex(([s]) => s === resizeStage);
                    return (
                      <li key={id} className={i < at ? "done" : i === at ? "now" : ""}>
                        <span aria-hidden="true">{i < at ? "✓" : i === at ? "" : ""}</span>
                        {text}
                      </li>
                    );
                  })}
                </ol>
                <small>
                  {resizeSeconds} s
                  {isAdmin && resizeWithAi && resizeStage === "ai" ? " · usually 10–40 s" : ""}
                </small>
              </div>
            )}

            <div className="cn-footer">
              {isAdmin && (
                <label className="cr-ai">
                  <input type="checkbox" checked={resizeWithAi} onChange={(e) => setResizeWithAi(e.target.checked)} />
                  Rearrange the layout with AI
                  <span>Admin trial</span>
                </label>
              )}
              <button className="ct-btn" onClick={() => setResize(null)} disabled={resizing}>Cancel</button>
              {(() => {
                const ok = resize.w >= 16 && resize.h >= 16 && resize.w <= 8000 && resize.h <= 8000
                  && !(resize.w === board.w && resize.h === board.h);
                return (
                  <>
                    <button className="ct-btn" disabled={!ok || resizing} onClick={() => resizeDesign(resize, false)}>
                      Resize this design
                    </button>
                    <button className="ct-btn primary" disabled={!ok || resizing} onClick={() => resizeDesign(resize, true)}>
                      {resizing ? (isAdmin && resizeWithAi ? "AI is rearranging…" : "Resizing…") : "Copy & resize"}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

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
              <NumberInput
                value={custom.w}
                onChange={(e) => setCustom({ ...custom, w: Number(e.target.value) })}
              />
              ×
              <NumberInput
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
      {/* the photo for a frame's Add photo / Replace photo */}
      <input
        ref={frameInput}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        hidden
        onChange={(e) => {
          pickFramePhoto(e.target.files[0]);
          e.target.value = "";
        }}
      />
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
