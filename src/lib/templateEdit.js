// Admin → Edit design: which published template Create should open for
// editing. Kept apart from templatePublish.js so /admin doesn't load the
// canvas library just to send someone to Create.
import { publicUrl } from "./r2";

// the note lasts one page load, so Create knows which template it edits
const EDIT_KEY = "kd-edit-template";
export function startTemplateEdit(row) {
  sessionStorage.setItem(EDIT_KEY, JSON.stringify({
    id: row.id,
    code: row.code,
    title: row.title,
    designUrl: publicUrl(row.files?.[0]?.key),
  }));
}
// read without removing: React may run a state initializer twice in development
export function peekTemplateEdit() {
  try {
    const note = JSON.parse(sessionStorage.getItem(EDIT_KEY));
    return note?.id && note?.designUrl ? note : null;
  } catch {
    return null;
  }
}
export function clearTemplateEdit() {
  try {
    sessionStorage.removeItem(EDIT_KEY);
  } catch {
    /* storage unavailable */
  }
}
