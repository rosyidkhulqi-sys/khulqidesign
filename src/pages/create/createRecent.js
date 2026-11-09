// The elements used last in Create, kept in this browser.

// kept in this browser, newest first; later it can move to the account
const RECENT_KEY = "kd-create-recent";
const RECENT_MAX = 24;

export function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

// puts an item at the front of the list, and returns the new list
export function saveRecent(kind, id) {
  const next = [{ kind, id }, ...loadRecent().filter((r) => !(r.kind === kind && r.id === id))].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}

// a tile still places its item, and also records it as recently used: on
// click, or once a drag is dropped on the page (not on drag start, so a row
// doesn't reorder under the pointer mid-drag)
export const withRecent = (placeItem, remember) => (kind, id) => {
  const base = placeItem(kind, id);
  if (kind === "vector" || kind === "background") return base;
  return {
    ...base,
    onClick: () => {
      remember(kind, id);
      base.onClick();
    },
    onDragEnd: (e) => {
      if (e.dataTransfer.dropEffect !== "none") remember(kind, id);
    },
  };
};

export function clearRecent() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* storage unavailable */
  }
}
