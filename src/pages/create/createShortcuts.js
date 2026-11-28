// Create's keyboard shortcuts in one place, in the order they're checked.
// Standard keys follow Illustrator and Figma: V/H/B/R/L/T tools, ⌘Z undo,
// ⌘] and ⌘[ layer order (Shift to the front or back), Shift+H/V flips,
// ⌘ +/−/0 zoom, arrows nudge (Shift by 10), Esc lets go, Delete removes.
//
// handleShortcut(e, k) gets the key event and k, what the editor offers:
//   obj           the selected object, or null
//   locked(obj)   whether it's locked in place
//   cropping      a crop is open; finishCrop(apply)
//   tool          the canvas tool; pickTool(name)
//   frameAdjusting; endFrameAdjust()
//   hasClipboard  Create's own copy exists (else the browser pastes)
//   render, arrange(how), undo, redo, duplicate, copy, cut, paste,
//   selectAll, zoomStep(dir), fitZoom, nudge(dx, dy), deselect, remove

// V select, H hand, B pencil, R shape, L line, T text
export const TOOL_KEYS = { v: "select", h: "hand", b: "pencil", r: "shape", l: "line", t: "text" };

export function handleShortcut(e, k) {
  const tag = e.target.tagName;
  // only fields people type in keep the keys; a slider, a checkbox or a
  // color well just used (Adjust, Effects) lets ⌘Z and the rest through
  const typingField = tag === "TEXTAREA" || tag === "SELECT"
    || (tag === "INPUT" && !["range", "checkbox", "radio", "color", "button"].includes(e.target.type));
  if (typingField) return;
  // arrows and Delete still belong to the slider or box itself
  if (tag === "INPUT" && (e.key.startsWith("Arrow") || e.key === "Delete" || e.key === "Backspace")) return;
  const { obj } = k;
  if (obj?.isEditing) return;

  if (k.cropping) {
    if (e.key === "Enter") k.finishCrop(true);
    if (e.key === "Escape") k.finishCrop(false);
    return;
  }
  // Shift+H / Shift+V flip the selection, as in Figma
  if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && obj && !k.locked(obj) && /^[hv]$/i.test(e.key)) {
    e.preventDefault();
    if (e.key.toLowerCase() === "h") obj.set({ flipX: !obj.flipX });
    else obj.set({ flipY: !obj.flipY });
    obj.setCoords();
    k.render();
    return;
  }
  // tool letters, and Esc back to Select from a drawing tool
  if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && TOOL_KEYS[e.key.toLowerCase()]) {
    e.preventDefault();
    k.pickTool(TOOL_KEYS[e.key.toLowerCase()]);
    return;
  }
  if (e.key === "Escape" && k.tool !== "select") {
    k.pickTool("select");
    return;
  }

  const mod = e.metaKey || e.ctrlKey;
  if (mod && obj && (e.code === "BracketRight" || e.code === "BracketLeft")) {
    e.preventDefault();
    const up = e.code === "BracketRight";
    k.arrange(e.shiftKey ? (up ? "front" : "back") : (up ? "forward" : "backward"));
    return;
  }
  if (mod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) k.redo();
    else k.undo();
  } else if (mod && e.key.toLowerCase() === "y") {
    e.preventDefault();
    k.redo();
  } else if (mod && e.key.toLowerCase() === "d" && obj) {
    e.preventDefault();
    k.duplicate();
  } else if (mod && e.key.toLowerCase() === "c" && obj) {
    e.preventDefault();
    k.copy();
  } else if (mod && e.key.toLowerCase() === "x" && obj) {
    e.preventDefault();
    k.cut();
  } else if (mod && e.key.toLowerCase() === "v" && k.hasClipboard) {
    // without our own copy, the browser's paste is left alone
    e.preventDefault();
    k.paste();
  } else if (mod && e.key.toLowerCase() === "a") {
    e.preventDefault();
    k.selectAll();
  } else if (mod && (e.key === "=" || e.key === "+")) {
    // the page zooms, not the browser
    e.preventDefault();
    k.zoomStep(1);
  } else if (mod && e.key === "-") {
    e.preventDefault();
    k.zoomStep(-1);
  } else if (mod && e.key === "0") {
    e.preventDefault();
    k.fitZoom();
  } else if (e.key.startsWith("Arrow") && obj && !mod) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    k.nudge(dx, dy);
  } else if (e.key === "Escape" && k.frameAdjusting) {
    k.endFrameAdjust();
  } else if (e.key === "Escape" && obj) {
    k.deselect();
  } else if ((e.key === "Delete" || e.key === "Backspace") && obj) {
    e.preventDefault();
    k.remove();
  }
}
