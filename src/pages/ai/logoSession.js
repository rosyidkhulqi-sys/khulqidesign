// The logo maker's last session, kept for this browser tab: what was typed,
// the symbols found, the shuffle, the logo picked, and the title of the
// design it opened in Create. Coming back from Create shows the same twelve
// logos, so another one can be picked without making them again.
const KEY = "kd-logo-session";

export function readLogoSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? null;
  } catch {
    return null;
  }
}

export function saveLogoSession(session) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // storage full or blocked: the session just isn't kept
  }
}

// back to the AI page on its Logo tab (it reads the tab once from here)
export function openLogoMaker(setPage) {
  try {
    sessionStorage.setItem("kd-ai-kind", "logo");
  } catch {
    // the AI page then opens on its first tab
  }
  setPage("ai");
}
