// Browsing is open to everyone; using anything (downloading, copying,
// editing, Create, the AI tools) needs an account, a free one is enough.
// askLogin() opens the site-wide "log in to continue" dialog that App shows.
export const ASK_LOGIN = "kd:ask-login";

// reason: what the visitor tried, picks the dialog's wording
// ("download" | "edit" | "create" | "ai")
export function askLogin(reason = "download") {
  window.dispatchEvent(new CustomEvent(ASK_LOGIN, { detail: reason }));
}
