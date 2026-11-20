// Drafts kept in this browser (IndexedDB), files included, so work that
// isn't published yet survives a refresh, as on The Noun Project's upload.
// Every call fails quietly: without storage (a private window) nothing is
// kept and the page works as before.
const DB = "kd-drafts";
const STORE = "drafts";

const open = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const run = async (mode, work) => {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

export const loadDraft = (key) => run("readonly", (s) => s.get(key)).catch(() => null);
export const saveDraft = (key, value) => run("readwrite", (s) => s.put(value, key)).catch(() => {});
export const clearDraft = (key) => run("readwrite", (s) => s.delete(key)).catch(() => {});
