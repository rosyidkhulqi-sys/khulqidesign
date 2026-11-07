// Saved Create designs ("Projects"), kept in this browser for now.
//   kd-create-projects       list of { id, name, w, h, pages, updated, thumb }
//   kd-create-project:<id>   the design itself (size and every page)
//   kd-create-current        the id of the design that was open last
// Later the backend stores the same records in the user's account; only this
// file needs to change.

const INDEX_KEY = "kd-create-projects";
const CURRENT_KEY = "kd-create-current";
const dataKey = (id) => `kd-create-project:${id}`;

// the one-design storage used before projects existed
const OLD_DRAFT_KEY = "kd-create-draft";
const OLD_NAME_KEY = "kd-create-name";

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const newProjectId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// newest first
export const listProjects = () =>
  read(INDEX_KEY, []).sort((a, b) => b.updated - a.updated);

export const loadProject = (id) => read(dataKey(id), null);

export const currentProjectId = () => read(CURRENT_KEY, null);

export const setCurrentProject = (id) => write(CURRENT_KEY, id);

// saves a design and its card; false when the browser refuses (storage full)
export function saveProject(id, snap, meta) {
  if (!write(dataKey(id), snap)) return false;
  const list = read(INDEX_KEY, []);
  const old = list.find((p) => p.id === id);
  const entry = { ...old, ...meta, id, updated: Date.now() };
  // keep the last thumbnail when this save didn't make a new one
  if (!entry.thumb && old?.thumb) entry.thumb = old.thumb;
  return write(INDEX_KEY, [entry, ...list.filter((p) => p.id !== id)]);
}

// a new name only touches the card, not the design or its date
export function renameProject(id, name) {
  const list = read(INDEX_KEY, []);
  write(INDEX_KEY, list.map((p) => (p.id === id ? { ...p, name } : p)));
}

export function deleteProject(id) {
  try {
    localStorage.removeItem(dataKey(id));
  } catch {
    /* storage unavailable */
  }
  write(INDEX_KEY, read(INDEX_KEY, []).filter((p) => p.id !== id));
  if (currentProjectId() === id) {
    try {
      localStorage.removeItem(CURRENT_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}

// turns the old single saved design into the first project, once
export function migrateOldDraft() {
  const old = read(OLD_DRAFT_KEY, null);
  if (!old) return;
  if (!read(INDEX_KEY, []).length) {
    const id = newProjectId();
    let name = "Untitled design";
    try {
      name = localStorage.getItem(OLD_NAME_KEY) || name;
    } catch {
      /* storage unavailable */
    }
    const pages = old.pages?.length ?? 1;
    if (saveProject(id, JSON.stringify(old), { name, w: old.w, h: old.h, pages })) {
      setCurrentProject(id);
    }
  }
  try {
    localStorage.removeItem(OLD_DRAFT_KEY);
    localStorage.removeItem(OLD_NAME_KEY);
  } catch {
    /* storage unavailable */
  }
}

// "just now", "5 min ago", "3 h ago", "2 d ago", then a date
export function timeAgo(time) {
  const s = Math.round((Date.now() - time) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return new Date(time).toLocaleDateString();
}
