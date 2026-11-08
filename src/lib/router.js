// A small router on the browser's History API: every page has its own
// address (/icons, /logos, /pricing...), Back and Forward work, and links can
// be shared or opened in a new tab. Pages still navigate with go(page, query);
// App keeps the URL in step. Unknown addresses show the 404 page.
//
// The host must send every path to index.html (public/_redirects for Netlify
// and Cloudflare Pages, vercel.json for Vercel); Vite's dev server already does.

// page key -> browser tab title
export const pageTitles = {
  home: "Khulqidesign: icons, vectors, logos, templates and footage",
  ai: "AI tools",
  icons: "Icons",
  vectors: "Vectors",
  logos: "Logos",
  templates: "Templates",
  footage: "Footage",
  create: "Create",
  downloads: "Your downloads",
  account: "Account",
  pricing: "Pricing",
  license: "License",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  login: "Log in",
  register: "Create account",
  notfound: "Page not found",
};

const known = new Set(Object.keys(pageTitles).filter((p) => p !== "notfound"));

export function pathFor(page, query = "") {
  const path = page === "home" ? "/" : `/${page}`;
  return query ? `${path}?q=${encodeURIComponent(query)}` : path;
}

// the page and search query the current address points to
export function readLocation() {
  const { pathname, search } = window.location;
  const slug = pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  const query = new URLSearchParams(search).get("q") ?? "";
  if (slug === "" || slug === "index.html") return { page: "home", query };
  // only one level for now; asset addresses (/logos/<id>) come later
  return { page: known.has(slug) && slug !== "home" ? slug : "notfound", query };
}

export function titleFor(page) {
  return page === "home" ? pageTitles.home : `${pageTitles[page] ?? pageTitles.notfound} · Khulqidesign`;
}
