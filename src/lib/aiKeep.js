// Keeps an AI result while a visitor logs in to download it, so they come
// back to the same before/after instead of starting over. The pictures go to
// Cache Storage (it survives the Google sign-in redirect); which tool and
// file name go to sessionStorage, for this tab only.
const META = "kd-ai-result";
const CACHE = "kd-ai-results";

export async function keepResult(tool, file, blob, option) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put("/kept/before", new Response(file));
    await cache.put("/kept/after", new Response(blob));
    sessionStorage.setItem(META, JSON.stringify({ tool, name: file.name, type: file.type, option }));
  } catch {
    /* private window: the visitor just runs the tool again after logging in */
  }
}

// the tool a kept result belongs to, or null
export function keptTool() {
  try {
    return JSON.parse(sessionStorage.getItem(META))?.tool ?? null;
  } catch {
    return null;
  }
}

// { file, blob, option } for this tool, or null
export async function restoreResult(tool) {
  try {
    const meta = JSON.parse(sessionStorage.getItem(META));
    if (meta?.tool !== tool) return null;
    const cache = await caches.open(CACHE);
    const [before, after] = await Promise.all([cache.match("/kept/before"), cache.match("/kept/after")]);
    if (!before || !after) return null;
    return {
      file: new File([await before.blob()], meta.name, { type: meta.type }),
      blob: await after.blob(),
      option: meta.option,
    };
  } catch {
    return null;
  }
}

export function forgetResult() {
  try {
    sessionStorage.removeItem(META);
    caches.delete(CACHE);
  } catch {
    /* nothing kept */
  }
}

// The Animate studio's choices, kept the same way while a visitor logs in to
// export; read once, when the studio opens again.
const ANIMATE = "kd-animate-choices";

export function keepAnimate(choices) {
  try {
    sessionStorage.setItem(ANIMATE, JSON.stringify(choices));
  } catch {
    /* no storage: the studio just starts fresh */
  }
}

export function keptAnimate() {
  try {
    return sessionStorage.getItem(ANIMATE) !== null;
  } catch {
    return false;
  }
}

export function takeAnimate() {
  try {
    const choices = JSON.parse(sessionStorage.getItem(ANIMATE));
    sessionStorage.removeItem(ANIMATE);
    return choices;
  } catch {
    return null;
  }
}
